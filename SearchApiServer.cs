using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using KeePass.Plugins;
using KeePassLib;
using KeePassLib.Utility;

namespace HttpsTypeSearch
{
	internal sealed class SearchApiServer : IDisposable
	{
		private const string LogFileName = "HttpsTypeSearchApi.log";
		private static readonly Encoding Utf8WithoutBom = new UTF8Encoding(false);
		private readonly IPluginHost mHost;
		private readonly JavaScriptSerializer mSerializer = new JavaScriptSerializer();
		private readonly List<ListenerRegistration> mListeners = new List<ListenerRegistration>();
		private volatile bool mStopping;

		public string StartError { get; private set; }

		public SearchApiServer(IPluginHost host)
		{
			if (host == null) throw new ArgumentNullException("host");
			mHost = host;
		}

		public void Start()
		{
			if (!SearchApiSettings.Enabled) return;

			mStopping = false;
			StartError = null;
			var startFailures = new List<string>();
			var prefixes = SearchApiSettings.GetPrefixes().ToArray();

			try
			{
				HttpsCertificateManager.EnsureBindings(prefixes, false);
			}
			catch (Exception ex)
			{
				StartError = ex.Message;
				LogMessage("HTTPS binding provisioning failed: " + ex);
				return;
			}

			foreach (var prefix in prefixes)
			{
				try
				{
					var listener = new HttpListener();
					listener.Prefixes.Add(prefix);
					listener.Start();

					var registration = new ListenerRegistration();
					registration.Prefix = prefix;
					registration.Listener = listener;
					registration.Thread = new Thread(ListenLoop);
					registration.Thread.IsBackground = true;
					registration.Thread.Name = "HttpsTypeSearchApi " + prefix;
					mListeners.Add(registration);
					registration.Thread.Start(registration);
				}
				catch (Exception ex)
				{
					startFailures.Add(prefix + " => " + ex.Message);
				}
			}

			if (mListeners.Count == 0)
			{
				StartError = startFailures.Count > 0 ? String.Join(Environment.NewLine, startFailures.ToArray()) : "No API listeners started.";
				Stop();
				return;
			}

			LogMessage("API listeners started:" + Environment.NewLine + String.Join(Environment.NewLine, mListeners.Select(listener => listener.Prefix).ToArray()));
			if (startFailures.Count > 0)
			{
				LogMessage("Some API listeners failed to start:" + Environment.NewLine + String.Join(Environment.NewLine, startFailures.ToArray()));
			}
		}

		public void Stop()
		{
			mStopping = true;
			foreach (var registration in mListeners)
			{
				try { registration.Listener.Close(); }
				catch (ObjectDisposedException) { }
			}

			foreach (var registration in mListeners)
			{
				if (registration.Thread != null)
				{
					registration.Thread.Join(1000);
				}
			}

			mListeners.Clear();
		}

		public void Dispose()
		{
			Stop();
		}

		private void ListenLoop(object state)
		{
			var registration = (ListenerRegistration)state;
			while (!mStopping && registration.Listener != null)
			{
				HttpListenerContext context;
				try
				{
					context = registration.Listener.GetContext();
				}
				catch (HttpListenerException)
				{
					break;
				}
				catch (ObjectDisposedException)
				{
					break;
				}

				ThreadPool.QueueUserWorkItem(HandleRequest, context);
			}
		}

		private void HandleRequest(object state)
		{
			var context = (HttpListenerContext)state;
			try
			{
				ProcessRequest(context);
			}
			catch (ApiException ex)
			{
				LogException(context.Request, ex);
				WriteJson(context, ex.StatusCode, new Dictionary<string, object> { { "error", ex.Message } });
			}
			catch (Exception ex)
			{
				LogException(context.Request, ex);
				WriteJson(context, 500, new Dictionary<string, object> { { "error", "Internal server error." }, { "detail", ex.Message } });
			}
			finally
			{
				try { context.Response.OutputStream.Close(); }
				catch (Exception) { }
			}
		}

		private void ProcessRequest(HttpListenerContext context)
		{
			var request = context.Request;
			var path = NormalizePath(request.Url.AbsolutePath);

			if (!IsLoopback(request)) throw new ApiException(403, "Only loopback requests are allowed.");
			if (!String.Equals(request.HttpMethod, "GET", StringComparison.OrdinalIgnoreCase))
			{
				context.Response.Headers["Allow"] = "GET";
				throw new ApiException(405, "Only GET is supported.");
			}

			if (path == "/health")
			{
				WriteJson(context, 200, new Dictionary<string, object>
				{
					{ "status", mListeners.Count > 0 ? "ok" : "error" },
					{ "authentication", "bearer" },
					{ "passwordEndpointEnabled", SearchApiSettings.AllowSensitiveEndpoints },
					{ "passwordReturnedInResults", SearchApiSettings.ReturnPasswords },
					{ "otpEndpointEnabled", true },
					{ "otpReturnedInResults", SearchApiSettings.ReturnOtpCurrent },
					{ "resolveReferences", SearchSettings.ResolveReferences },
					{ "maxResults", SearchApiSettings.MaxResults },
					{ "activePrefixes", mListeners.Select(listener => listener.Prefix).ToArray() },
					{ "configuredPrefixes", SearchApiSettings.GetPrefixes().ToArray() }
				});
				return;
			}

			if (!IsAuthorized(request))
			{
				context.Response.Headers["WWW-Authenticate"] = "Bearer realm=\"HttpsTypeSearch\"";
				throw new ApiException(401, "Missing or invalid API token.");
			}

			if (path == "/search")
			{
				HandleSearch(context);
				return;
			}

			if (path.StartsWith("/entries/", StringComparison.OrdinalIgnoreCase))
			{
				HandleEntryRequest(context, path);
				return;
			}

			throw new ApiException(404, "Endpoint not found.");
		}

		private void HandleSearch(HttpListenerContext context)
		{
			var query = ParseQueryString(context.Request.Url.Query);
			string termValue;
			string limitText;
			var term = (query.TryGetValue("term", out termValue) ? termValue : String.Empty).Trim();
			if (term.Length < 1) throw new ApiException(400, "Query parameter 'term' must be at least 1 character.");

			var limit = ParseLimit(query.TryGetValue("limit", out limitText) ? limitText : null);
			var databases = GetOpenDatabases();
			if (databases.Length == 0) throw new ApiException(409, "No unlocked KeePass databases are open.");

			var searcher = new Searcher(databases);
			var results = searcher.Search(term).GetAllResults().ToList();
			results.Sort(new SearchResultPrecedenceComparer());

			var items = new List<Dictionary<string, object>>();
			foreach (var result in results.Take(limit))
			{
				try { items.Add(CreateSearchResultPayload(result)); }
				catch (Exception ex) { LogEntryPayloadFailure(result, ex); }
			}

			WriteJson(context, 200, new Dictionary<string, object>
			{
				{ "term", term },
				{ "count", results.Count },
				{ "returned", items.Count },
				{ "items", items }
			});
		}

		private void HandleEntryRequest(HttpListenerContext context, string path)
		{
			var segments = path.Split(new[] { '/' }, StringSplitOptions.RemoveEmptyEntries);
			if (segments.Length < 2) throw new ApiException(400, "Entry UUID is required.");

			var uuid = ParseUuid(segments[1]);
			var entryLocation = FindEntry(uuid);
			if (entryLocation == null) throw new ApiException(404, "Entry not found.");

			if (segments.Length == 2)
			{
				WriteJson(context, 200, CreateEntryPayload(entryLocation.Database, entryLocation.Entry));
				return;
			}

			if (segments.Length == 3 && String.Equals(segments[2], "password", StringComparison.OrdinalIgnoreCase))
			{
				if (!SearchApiSettings.AllowSensitiveEndpoints) throw new ApiException(403, "Password endpoint is disabled.");

				WriteJson(context, 200, new Dictionary<string, object>
				{
					{ "entryUuid", entryLocation.Entry.Uuid.ToHexString() },
					{ "title", EntryFieldReader.ReadFieldValue(entryLocation.Database, entryLocation.Entry, PwDefs.TitleField, SearchSettings.ResolveReferences) },
					{ "password", EntryFieldReader.ReadApiFieldValue(entryLocation.Database, entryLocation.Entry, PwDefs.PasswordField, SearchSettings.ResolveReferences, true) }
				});
				return;
			}

			if (segments.Length == 3 && String.Equals(segments[2], "otp", StringComparison.OrdinalIgnoreCase))
			{
				var otpCurrent = InvokeOnMainThread(delegate
				{
					return EntryFieldReader.ReadCurrentOtpValue(entryLocation.Database, entryLocation.Entry);
				});

				if (String.IsNullOrEmpty(otpCurrent)) throw new ApiException(409, "OTP is not available for this entry.");

				WriteJson(context, 200, new Dictionary<string, object>
				{
					{ "entryUuid", entryLocation.Entry.Uuid.ToHexString() },
					{ "title", EntryFieldReader.ReadFieldValue(entryLocation.Database, entryLocation.Entry, PwDefs.TitleField, SearchSettings.ResolveReferences) },
					{ "otpCurrent", otpCurrent }
				});
				return;
			}

			throw new ApiException(404, "Endpoint not found.");
		}

		private int ParseLimit(string limitText)
		{
			int limit;
			if (!Int32.TryParse(limitText, out limit) || limit <= 0)
			{
				limit = SearchApiSettings.MaxResults;
			}

			return Math.Min(limit, SearchApiSettings.MaxResults);
		}

		private PwDatabase[] GetOpenDatabases()
		{
			return InvokeOnMainThread(delegate
			{
				var documentManager = mHost.MainWindow.DocumentManager;
				if (documentManager == null) return new PwDatabase[0];
				return documentManager.GetOpenDatabases().Where(database => database != null).ToArray();
			});
		}

		private EntryLocation FindEntry(PwUuid uuid)
		{
			foreach (var database in GetOpenDatabases())
			{
				var entry = FindEntry(database.RootGroup, uuid);
				if (entry != null) return new EntryLocation { Database = database, Entry = entry };
			}

			return null;
		}

		private PwEntry FindEntry(PwGroup group, PwUuid uuid)
		{
			foreach (var entry in group.Entries)
			{
				if (entry.Uuid.Equals(uuid)) return entry;
			}

			foreach (var childGroup in group.Groups)
			{
				var entry = FindEntry(childGroup, uuid);
				if (entry != null) return entry;
			}

			return null;
		}

		private Dictionary<string, object> CreateSearchResultPayload(SearchResult result)
		{
			var payload = CreateEntryPayload(result.Database, result.Entry);
			payload["MatchedField"] = result.FieldName;
			payload["MatchedValue"] = result.FieldValue;
			payload["MatchStart"] = result.Start;
			payload["MatchLength"] = result.Length;
			return payload;
		}

		private Dictionary<string, object> CreateEntryPayload(PwDatabase database, PwEntry entry)
		{
			var payload = new Dictionary<string, object>
			{
				{ "Uuid", entry.Uuid.ToHexString() },
				{ "Database", database.Name },
				{ "GroupPath", GetGroupPath(entry) },
				{ PwDefs.TitleField, EntryFieldReader.ReadFieldValue(database, entry, PwDefs.TitleField, SearchSettings.ResolveReferences) },
				{ PwDefs.UserNameField, EntryFieldReader.ReadFieldValue(database, entry, PwDefs.UserNameField, SearchSettings.ResolveReferences) },
				{ PwDefs.UrlField, EntryFieldReader.ReadFieldValue(database, entry, PwDefs.UrlField, SearchSettings.ResolveReferences) },
				{ PwDefs.NotesField, EntryFieldReader.ReadFieldValue(database, entry, PwDefs.NotesField, SearchSettings.ResolveReferences) },
				{ "Tags", entry.Tags == null ? new string[0] : entry.Tags.ToArray() },
				{ "Expires", entry.Expires },
				{ "ExpiryTimeUtc", entry.Expires ? entry.ExpiryTime.ToUniversalTime().ToString("o") : null },
				{ "CustomFields", GetCustomFields(database, entry) }
			};

			if (SearchApiSettings.ReturnPasswords)
			{
				payload[PwDefs.PasswordField] = EntryFieldReader.ReadApiFieldValue(database, entry, PwDefs.PasswordField, SearchSettings.ResolveReferences, true);
			}

			if (SearchApiSettings.ReturnOtpCurrent)
			{
				var otpCurrent = InvokeOnMainThread(delegate
				{
					return EntryFieldReader.ReadCurrentOtpValue(database, entry);
				});
				if (!string.IsNullOrEmpty(otpCurrent))
				{
					payload["OtpCurrent"] = otpCurrent;
				}
			}

			return payload;
		}

		private Dictionary<string, object> GetCustomFields(PwDatabase database, PwEntry entry)
		{
			var customFields = new Dictionary<string, object>();
			foreach (var field in entry.Strings)
			{
				if (!field.Value.IsProtected && !PwDefs.IsStandardField(field.Key))
				{
					customFields[field.Key] = EntryFieldReader.ReadFieldValue(database, entry, field.Key, SearchSettings.ResolveReferences);
				}
			}

			return customFields;
		}

		private string GetGroupPath(PwEntry entry)
		{
			var groups = new List<string>();
			var group = entry.ParentGroup;
			while (group != null)
			{
				if (!String.IsNullOrEmpty(group.Name)) groups.Insert(0, group.Name);
				group = group.ParentGroup;
			}

			return String.Join(" / ", groups.ToArray());
		}

		private bool IsLoopback(HttpListenerRequest request)
		{
			return request.RemoteEndPoint != null && IPAddress.IsLoopback(request.RemoteEndPoint.Address);
		}

		private bool IsAuthorized(HttpListenerRequest request)
		{
			var headerToken = request.Headers["X-Api-Token"];
			if (!String.IsNullOrEmpty(headerToken)) return String.Equals(headerToken.Trim(), SearchApiSettings.ApiToken, StringComparison.Ordinal);

			var authorization = request.Headers["Authorization"];
			if (String.IsNullOrEmpty(authorization)) return false;
			const string bearerPrefix = "Bearer ";
			if (!authorization.StartsWith(bearerPrefix, StringComparison.OrdinalIgnoreCase)) return false;

			var token = authorization.Substring(bearerPrefix.Length).Trim();
			return String.Equals(token, SearchApiSettings.ApiToken, StringComparison.Ordinal);
		}

		private void WriteJson(HttpListenerContext context, int statusCode, object payload)
		{
			var response = context.Response;
			response.StatusCode = statusCode;
			response.ContentType = "application/json; charset=utf-8";
			response.ContentEncoding = Utf8WithoutBom;
			response.Headers["Cache-Control"] = "no-store";

			var json = mSerializer.Serialize(payload);
			using (var writer = new StreamWriter(response.OutputStream, Utf8WithoutBom))
			{
				writer.Write(json);
			}
		}

		private void LogException(HttpListenerRequest request, Exception ex)
		{
			try
			{
				var requestUrl = request != null && request.Url != null ? request.Url.ToString() : "(unknown request)";
				File.AppendAllText(GetLogFilePath(), DateTime.Now.ToString("o") + " " + requestUrl + Environment.NewLine + ex + Environment.NewLine + Environment.NewLine, Encoding.UTF8);
			}
			catch (Exception) { }
		}

		private void LogMessage(string message)
		{
			try
			{
				File.AppendAllText(GetLogFilePath(), DateTime.Now.ToString("o") + " " + message + Environment.NewLine + Environment.NewLine, Encoding.UTF8);
			}
			catch (Exception) { }
		}

		private void LogEntryPayloadFailure(SearchResult result, Exception ex)
		{
			try
			{
				var entryId = result != null && result.Entry != null ? result.Entry.Uuid.ToHexString() : "(unknown entry)";
				File.AppendAllText(GetLogFilePath(), DateTime.Now.ToString("o") + " Failed to serialize search result for entry " + entryId + Environment.NewLine + ex + Environment.NewLine + Environment.NewLine, Encoding.UTF8);
			}
			catch (Exception) { }
		}

		private string GetLogFilePath()
		{
			return Path.Combine(AppDomain.CurrentDomain.BaseDirectory, LogFileName);
		}

		private T InvokeOnMainThread<T>(Func<T> method)
		{
			if (mHost.MainWindow.InvokeRequired) return (T)mHost.MainWindow.Invoke(method);
			return method();
		}

		private PwUuid ParseUuid(string uuidText)
		{
			try { return new PwUuid(MemUtil.HexStringToByteArray(uuidText)); }
			catch (Exception) { throw new ApiException(400, "Invalid entry UUID."); }
		}

		private string NormalizePath(string path)
		{
			if (String.IsNullOrEmpty(path)) return "/";
			path = path.TrimEnd('/');
			return path.Length == 0 ? "/" : path;
		}

		private Dictionary<string, string> ParseQueryString(string query)
		{
			var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
			if (String.IsNullOrEmpty(query)) return values;

			var trimmedQuery = query.Length > 0 && query[0] == '?' ? query.Substring(1) : query;
			foreach (var pair in trimmedQuery.Split(new[] { '&' }, StringSplitOptions.RemoveEmptyEntries))
			{
				var separatorIndex = pair.IndexOf('=');
				var rawKey = separatorIndex >= 0 ? pair.Substring(0, separatorIndex) : pair;
				var rawValue = separatorIndex >= 0 ? pair.Substring(separatorIndex + 1) : String.Empty;
				var key = UrlDecodeUtf8(rawKey);
				if (key.Length == 0) continue;
				values[key] = UrlDecodeUtf8(rawValue);
			}

			return values;
		}

		private string UrlDecodeUtf8(string value)
		{
			if (String.IsNullOrEmpty(value)) return String.Empty;
			return Uri.UnescapeDataString(value.Replace('+', ' '));
		}

		private sealed class ListenerRegistration
		{
			public string Prefix;
			public HttpListener Listener;
			public Thread Thread;
		}

		private sealed class ApiException : Exception
		{
			public int StatusCode { get; private set; }
			public ApiException(int statusCode, string message) : base(message) { StatusCode = statusCode; }
		}

		private sealed class EntryLocation
		{
			public PwDatabase Database;
			public PwEntry Entry;
		}

		private sealed class SearchResultPrecedenceComparer : IComparer<SearchResult>
		{
			public int Compare(SearchResult x, SearchResult y)
			{
				var result = -(x.Start == 0).CompareTo(y.Start == 0);
				if (result == 0) result = -(x.FieldName == PwDefs.TitleField).CompareTo(y.FieldName == PwDefs.TitleField);
				if (result == 0) result = x.ResultIndex.CompareTo(y.ResultIndex);
				return result;
			}
		}
	}
}

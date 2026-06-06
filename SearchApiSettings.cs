using System;
using System.Linq;
using System.Net;
using System.Security.Cryptography;
using KeePass.Plugins;

namespace HttpsTypeSearch
{
	internal static class SearchApiSettings
	{
		private const string ConfigRoot = "HttpsTypeSearch.Api.";
		private const string EnabledKey = ConfigRoot + "Enabled";
		private const string ListenAddressesKey = ConfigRoot + "ListenAddresses";
		private const string PortKey = ConfigRoot + "Port";
		private const string TokenKey = ConfigRoot + "Token";
		private const string AllowSensitiveKey = ConfigRoot + "AllowSensitiveEndpoints";
		private const string ReturnPasswordsKey = ConfigRoot + "ReturnPasswords";
		private const string ReturnOtpCurrentKey = ConfigRoot + "ReturnOtpCurrent";
		private const string MaxResultsKey = ConfigRoot + "MaxResults";

		private const string DefaultListenAddresses = "127.0.0.1;localhost";
		private const int DefaultPort = 19456;
		private const int DefaultMaxResults = 100;
		private const int MaximumAllowedResults = 500;

		public static bool Enabled { get; private set; }
		public static string ListenAddresses { get; private set; }
		public static int Port { get; private set; }
		public static string ApiToken { get; private set; }
		public static bool AllowSensitiveEndpoints { get; private set; }
		public static bool ReturnPasswords { get; private set; }
		public static bool ReturnOtpCurrent { get; private set; }
		public static int MaxResults { get; private set; }
		public static bool TokenWasGenerated { get; private set; }

		public static void Load(IPluginHost host)
		{
			if (host == null) throw new ArgumentNullException("host");

			Enabled = ReadBool(host, EnabledKey, true);
			ListenAddresses = NormalizeAddresses(ReadString(host, ListenAddressesKey, DefaultListenAddresses));
			Port = Math.Max(1, Math.Min(65535, ReadInt(host, PortKey, DefaultPort)));
			AllowSensitiveEndpoints = ReadBool(host, AllowSensitiveKey, true);
			ReturnPasswords = ReadBool(host, ReturnPasswordsKey, false);
			ReturnOtpCurrent = ReadBool(host, ReturnOtpCurrentKey, false);
			MaxResults = Math.Max(1, Math.Min(MaximumAllowedResults, ReadInt(host, MaxResultsKey, DefaultMaxResults)));

			ApiToken = ReadString(host, TokenKey, null);
			TokenWasGenerated = String.IsNullOrEmpty(ApiToken);
			if (TokenWasGenerated)
			{
				ApiToken = GenerateToken();
			}
		}

		public static void Apply(bool enabled, string listenAddresses, int port, string apiToken, bool allowSensitiveEndpoints, bool returnPasswords, bool returnOtpCurrent, int maxResults)
		{
			Enabled = enabled;
			ListenAddresses = NormalizeAddresses(listenAddresses);
			Port = Math.Max(1, Math.Min(65535, port));
			ApiToken = String.IsNullOrWhiteSpace(apiToken) ? GenerateToken() : apiToken.Trim();
			AllowSensitiveEndpoints = allowSensitiveEndpoints;
			ReturnPasswords = returnPasswords;
			ReturnOtpCurrent = returnOtpCurrent;
			MaxResults = Math.Max(1, Math.Min(MaximumAllowedResults, maxResults));
			TokenWasGenerated = false;
		}

		public static void RegenerateToken()
		{
			ApiToken = GenerateToken();
			TokenWasGenerated = false;
		}

		public static void Save(IPluginHost host)
		{
			if (host == null) return;

			host.CustomConfig.SetString(EnabledKey, Enabled.ToString());
			host.CustomConfig.SetString(ListenAddressesKey, ListenAddresses);
			host.CustomConfig.SetString(PortKey, Port.ToString());
			host.CustomConfig.SetString(TokenKey, ApiToken);
			host.CustomConfig.SetString(AllowSensitiveKey, AllowSensitiveEndpoints.ToString());
			host.CustomConfig.SetString(ReturnPasswordsKey, ReturnPasswords.ToString());
			host.CustomConfig.SetString(ReturnOtpCurrentKey, ReturnOtpCurrent.ToString());
			host.CustomConfig.SetString(MaxResultsKey, MaxResults.ToString());
		}

		public static string[] GetPrefixes()
		{
			return ListenAddresses
				.Split(new[] { ';', '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries)
				.Select(value => value.Trim())
				.Where(value => value.Length > 0)
				.Select(value => String.Format("https://{0}:{1}/", value, Port))
				.ToArray();
		}

		private static string NormalizeAddresses(string addresses)
		{
			var values = (addresses ?? String.Empty)
				.Split(new[] { ';', '\r', '\n', ',', ' ' }, StringSplitOptions.RemoveEmptyEntries)
				.Select(NormalizeAddress)
				.Where(value => value.Length > 0)
				.Distinct(StringComparer.OrdinalIgnoreCase)
				.ToArray();

			return values.Length > 0 ? String.Join(";", values) : DefaultListenAddresses;
		}

		private static string NormalizeAddress(string value)
		{
			var trimmed = (value ?? String.Empty).Trim();
			if (trimmed.Length == 0)
			{
				return String.Empty;
			}

			if (String.Equals(trimmed, "localhost", StringComparison.OrdinalIgnoreCase))
			{
				return "localhost";
			}

			IPAddress address;
			if (IPAddress.TryParse(trimmed, out address) && IPAddress.IsLoopback(address) && address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)
			{
				return address.ToString();
			}

			return String.Empty;
		}

		private static bool ReadBool(IPluginHost host, string key, bool defaultValue)
		{
			var value = host.CustomConfig.GetString(key);
			bool parsed;
			return Boolean.TryParse(value, out parsed) ? parsed : defaultValue;
		}

		private static int ReadInt(IPluginHost host, string key, int defaultValue)
		{
			var value = host.CustomConfig.GetString(key);
			int parsed;
			return Int32.TryParse(value, out parsed) ? parsed : defaultValue;
		}

		private static string ReadString(IPluginHost host, string key, string defaultValue)
		{
			var value = host.CustomConfig.GetString(key);
			return String.IsNullOrWhiteSpace(value) ? defaultValue : value.Trim();
		}

		private static string GenerateToken()
		{
			var bytes = new byte[32];
			using (var random = new RNGCryptoServiceProvider())
			{
				random.GetBytes(bytes);
			}

			var token = Convert.ToBase64String(bytes);
			return token.TrimEnd('=').Replace('+', '-').Replace('/', '_');
		}
	}
}
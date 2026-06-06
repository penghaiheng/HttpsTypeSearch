using System;
using KeePass.Plugins;

namespace HttpsTypeSearch
{
	internal static class SearchSettings
	{
		private const string ConfigRoot = "HttpsTypeSearch.Search.";
		private const string SearchTitleKey = ConfigRoot + "SearchTitle";
		private const string SearchUserNameKey = ConfigRoot + "SearchUserName";
		private const string SearchUrlKey = ConfigRoot + "SearchUrl";
		private const string SearchNotesKey = ConfigRoot + "SearchNotes";
		private const string SearchCustomFieldsKey = ConfigRoot + "SearchCustomFields";
		private const string SearchTagsKey = ConfigRoot + "SearchTags";
		private const string CaseSensitiveKey = ConfigRoot + "CaseSensitive";
		private const string ExcludeExpiredKey = ConfigRoot + "ExcludeExpired";
		private const string ResolveReferencesKey = ConfigRoot + "ResolveReferences";

		public static bool SearchTitle { get; private set; }
		public static bool SearchUserName { get; private set; }
		public static bool SearchUrl { get; private set; }
		public static bool SearchNotes { get; private set; }
		public static bool SearchCustomFields { get; private set; }
		public static bool SearchTags { get; private set; }
		public static bool CaseSensitive { get; private set; }
		public static bool ExcludeExpired { get; private set; }
		public static bool ResolveReferences { get; private set; }

		public static void Load(IPluginHost host)
		{
			if (host == null) throw new ArgumentNullException("host");

			SearchTitle = ReadBool(host, SearchTitleKey, true);
			SearchUserName = ReadBool(host, SearchUserNameKey, false);
			SearchUrl = ReadBool(host, SearchUrlKey, true);
			SearchNotes = ReadBool(host, SearchNotesKey, true);
			SearchCustomFields = ReadBool(host, SearchCustomFieldsKey, true);
			SearchTags = ReadBool(host, SearchTagsKey, true);
			CaseSensitive = ReadBool(host, CaseSensitiveKey, false);
			ExcludeExpired = ReadBool(host, ExcludeExpiredKey, false);
			ResolveReferences = ReadBool(host, ResolveReferencesKey, false);
		}

		public static void Apply(bool searchTitle, bool searchUserName, bool searchUrl, bool searchNotes, bool searchCustomFields, bool searchTags, bool caseSensitive, bool excludeExpired, bool resolveReferences)
		{
			SearchTitle = searchTitle;
			SearchUserName = searchUserName;
			SearchUrl = searchUrl;
			SearchNotes = searchNotes;
			SearchCustomFields = searchCustomFields;
			SearchTags = searchTags;
			CaseSensitive = caseSensitive;
			ExcludeExpired = excludeExpired;
			ResolveReferences = resolveReferences;
		}

		public static void Save(IPluginHost host)
		{
			if (host == null) return;

			host.CustomConfig.SetString(SearchTitleKey, SearchTitle.ToString());
			host.CustomConfig.SetString(SearchUserNameKey, SearchUserName.ToString());
			host.CustomConfig.SetString(SearchUrlKey, SearchUrl.ToString());
			host.CustomConfig.SetString(SearchNotesKey, SearchNotes.ToString());
			host.CustomConfig.SetString(SearchCustomFieldsKey, SearchCustomFields.ToString());
			host.CustomConfig.SetString(SearchTagsKey, SearchTags.ToString());
			host.CustomConfig.SetString(CaseSensitiveKey, CaseSensitive.ToString());
			host.CustomConfig.SetString(ExcludeExpiredKey, ExcludeExpired.ToString());
			host.CustomConfig.SetString(ResolveReferencesKey, ResolveReferences.ToString());
		}

		private static bool ReadBool(IPluginHost host, string key, bool defaultValue)
		{
			var value = host.CustomConfig.GetString(key);
			bool parsed;
			return Boolean.TryParse(value, out parsed) ? parsed : defaultValue;
		}
	}
}
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.Threading;
using KeePass.Util.Spr;
using KeePassLib;
using KeePassLib.Utility;

namespace HttpsTypeSearch
{
	internal class SearchResults
	{
		private readonly string mTerm;
		private readonly SearchResult[] mResults;
		private readonly object mLock = new object();
		private readonly AutoResetEvent mResultsUpdated = new AutoResetEvent(false);
		private readonly CompareOptions mStringComparison;
		private readonly bool mSearchTitle;
		private readonly bool mSearchUserName;
		private readonly bool mSearchUrl;
		private readonly bool mSearchNotes;
		private readonly bool mSearchCustomFields;
		private readonly bool mResolveReferences;
		private readonly bool mSearchTags;
		private volatile int mCount;
		private volatile bool mComplete;

		public SearchResults(int capacity, string term)
		{
			mTerm = term;
			mResults = new SearchResult[capacity];

			mStringComparison = SearchSettings.CaseSensitive ? CompareOptions.None : CompareOptions.IgnoreCase;
			mStringComparison |= CompareOptions.IgnoreKanaType | CompareOptions.IgnoreWidth | CompareOptions.IgnoreNonSpace;
			mSearchTitle = SearchSettings.SearchTitle;
			mSearchUserName = SearchSettings.SearchUserName;
			mSearchUrl = SearchSettings.SearchUrl;
			mSearchNotes = SearchSettings.SearchNotes;
			mSearchCustomFields = SearchSettings.SearchCustomFields;
			mSearchTags = SearchSettings.SearchTags;
			mResolveReferences = SearchSettings.ResolveReferences;
		}

		public SearchResults CreateChildResults(string term)
		{
			return new SearchResults(mResults.Length, term);
		}

		private IEnumerable<string> GetFieldsToSearch(PwEntry entry)
		{
			var fieldsToSearch = new List<string>((int)entry.Strings.UCount);
			if (mSearchTitle) fieldsToSearch.Add(PwDefs.TitleField);
			if (mSearchUserName) fieldsToSearch.Add(PwDefs.UserNameField);
			if (mSearchUrl) fieldsToSearch.Add(PwDefs.UrlField);
			if (mSearchNotes) fieldsToSearch.Add(PwDefs.NotesField);
			if (mSearchCustomFields)
			{
				foreach (var stringEntry in entry.Strings)
				{
					if (!stringEntry.Value.IsProtected && !PwDefs.IsStandardField(stringEntry.Key))
					{
						fieldsToSearch.Add(stringEntry.Key);
					}
				}
			}
			if (mSearchTags) fieldsToSearch.Add(EntryFieldReader.TagsVirtualFieldName);

			return fieldsToSearch;
		}

		public void AddResultIfMatchesTerm(PwDatabase context, PwEntry entry)
		{
			var addedResult = AddResultIfMatchesTerm(context, entry, false);
			if (!addedResult && mResolveReferences)
			{
				AddResultIfMatchesTerm(context, entry, true);
			}
		}

		private bool AddResultIfMatchesTerm(PwDatabase context, PwEntry entry, bool resolveReferences)
		{
			foreach (var fieldName in GetFieldsToSearch(entry))
			{
				string fieldValue;
				if (fieldName == EntryFieldReader.TagsVirtualFieldName)
				{
					fieldValue = StrUtil.TagsToString(entry.Tags, true);
				}
				else
				{
					fieldValue = entry.Strings.ReadSafeEx(fieldName);
					if (resolveReferences)
					{
						fieldValue = ResolveReferences(context, entry, fieldValue);
					}
				}

				if (!String.IsNullOrEmpty(fieldValue))
				{
					var foundIndex = CultureInfo.CurrentCulture.CompareInfo.IndexOf(fieldValue, mTerm, mStringComparison);
					if (foundIndex >= 0)
					{
						var title = EntryFieldReader.ReadFieldValue(context, entry, PwDefs.TitleField, mResolveReferences);
						AddResult(new SearchResult(context, entry, title, fieldName, fieldValue, foundIndex, mTerm.Length));
						return true;
					}
				}
			}

			return false;
		}

		private string ResolveReferences(PwDatabase context, PwEntry entry, string fieldValue)
		{
			if (fieldValue.IndexOf('{') < 0)
			{
				return null;
			}

			var sprContext = new SprContext(entry, context, SprCompileFlags.Deref) { ForcePlainTextPasswords = false };
			var result = SprEngine.Compile(fieldValue, sprContext);
			if (CultureInfo.CurrentCulture.CompareInfo.Compare(result, fieldValue, mStringComparison) == 0)
			{
				return null;
			}

			return result;
		}

		public void AddResultIfMatchesTerm(SearchResult candidate)
		{
			var fieldValue = candidate.FieldValue;
			if (fieldValue.Length > candidate.Start + mTerm.Length && CultureInfo.CurrentCulture.CompareInfo.Compare(fieldValue.Substring(candidate.Start, mTerm.Length), mTerm, mStringComparison) == 0)
			{
				AddResult(new SearchResult(candidate.Database, candidate.Entry, candidate.Title, candidate.FieldName, fieldValue, candidate.Start, mTerm.Length));
			}
			else
			{
				AddResultIfMatchesTerm(candidate.Database, candidate.Entry);
			}
		}

		private void AddResult(SearchResult result)
		{
			lock (mLock)
			{
				if (mComplete)
				{
					throw new InvalidOperationException("Search results have been completed");
				}

				result.SetResultIndex(mCount);
				mResults[mCount++] = result;
			}

			mResultsUpdated.Set();
		}

		public void SetComplete()
		{
			lock (mLock)
			{
				mComplete = true;
			}

			mResultsUpdated.Set();
		}

		public SearchResult[] GetAvailableResults(ref int index, out bool complete)
		{
			int count;
			lock (mLock)
			{
				count = mCount;
				complete = mComplete;
			}

			if (count <= index)
			{
				return new SearchResult[0];
			}

			var availableResults = new SearchResult[count - index];
			Array.Copy(mResults, index, availableResults, 0, availableResults.Length);
			index = count;
			return availableResults;
		}

		public IEnumerable<SearchResult> GetAllResults()
		{
			int availableCount = 0;

			for (var i = 0; i < mResults.Length; i++)
			{
				if (i >= availableCount)
				{
					do
					{
						bool moreAvailable;
						bool complete;

						lock (mLock)
						{
							moreAvailable = mCount > availableCount;
							availableCount = mCount;
							complete = mComplete;
						}

						if (!moreAvailable)
						{
							if (complete)
							{
								yield break;
							}

							mResultsUpdated.WaitOne();
						}
						else
						{
							break;
						}
					} while (true);

					Debug.Assert(i < availableCount, "More should be available now");
				}

				yield return mResults[i];
			}
		}
	}
}
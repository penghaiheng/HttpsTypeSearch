using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using KeePassLib;

namespace HttpsTypeSearch
{
	internal class Searcher
	{
		private readonly PwDatabase[] mDatabases;
		private readonly Dictionary<string, SearchResults> mSearches = new Dictionary<string, SearchResults>();

		public Searcher(PwDatabase[] databases)
		{
			mDatabases = databases;
		}

		public SearchResults Search(string term)
		{
			if (term.Length < 1)
			{
				throw new ArgumentException("Search term must be at least 1 character");
			}

			SearchResults parentResults = null;

			var termParent = term;
			while (termParent.Length >= 1)
			{
				if (mSearches.TryGetValue(termParent, out parentResults))
				{
					if (termParent == term)
					{
						return parentResults;
					}

					break;
				}

				termParent = termParent.Remove(termParent.Length - 1, 1);
			}

			SearchResults searchResults;
			if (parentResults == null)
			{
				searchResults = new SearchResults(GetCountOfAllDatabaseEntries(), term);

				var rootSearchThread = new Thread(RootSearchWorker) { Name = term };
				rootSearchThread.Start(searchResults);
			}
			else
			{
				searchResults = parentResults.CreateChildResults(term);

				var childSearchThread = new Thread(ChildSearchWorker) { Name = term };
				childSearchThread.Start(new ChildSearchWorkerState { Source = parentResults, Results = searchResults });
			}

			mSearches.Add(term, searchResults);

			return searchResults;
		}

		private int GetCountOfAllDatabaseEntries()
		{
			return (from database in mDatabases select (int)database.RootGroup.GetEntriesCount(true)).Sum();
		}

		private void RootSearchWorker(object stateObject)
		{
			var results = (SearchResults)stateObject;
			var excludeExpired = SearchSettings.ExcludeExpired;
			var searchStartTime = DateTime.Now;

			foreach (var database in mDatabases)
			{
				SearchGroup(database, database.RootGroup, results, excludeExpired, searchStartTime);
			}

			results.SetComplete();
		}

		private void SearchGroup(PwDatabase context, PwGroup group, SearchResults results, bool excludeExpired, DateTime searchStartTime)
		{
			if (group.EnableSearching ?? true)
			{
				foreach (var childGroup in group.Groups)
				{
					SearchGroup(context, childGroup, results, excludeExpired, searchStartTime);
				}

				foreach (var entry in group.Entries)
				{
					if (!(excludeExpired && entry.Expires && searchStartTime > entry.ExpiryTime))
					{
						results.AddResultIfMatchesTerm(context, entry);
					}
				}
			}
		}

		private struct ChildSearchWorkerState
		{
			public SearchResults Source;
			public SearchResults Results;
		}

		private void ChildSearchWorker(object stateObject)
		{
			var state = (ChildSearchWorkerState)stateObject;

			bool complete;
			var index = 0;
			do
			{
				foreach (var entry in state.Source.GetAvailableResults(ref index, out complete))
				{
					state.Results.AddResultIfMatchesTerm(entry);
				}
			} while (!complete);

			state.Results.SetComplete();
		}
	}
}
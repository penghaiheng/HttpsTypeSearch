using System;
using System.Linq;
using System.Windows.Forms;
using KeePass;
using KeePass.Forms;
using KeePass.Plugins;
using KeePass.UI;
using KeePassLib;

namespace HttpsTypeSearch
{
	public sealed class HttpsTypeSearchExt : Plugin
	{
		private IPluginHost mHost;
		private SearchApiServer mSearchApiServer;

		public override string UpdateUrl
		{
			get { return String.Empty; }
		}

		public override bool Initialize(IPluginHost host)
		{
			mHost = host;
			SearchSettings.Load(host);
			SearchApiSettings.Load(host);

			GlobalWindowManager.WindowAdded += OnWindowAdded;
			RestartApiServer();

			if (SearchApiSettings.TokenWasGenerated || !String.IsNullOrEmpty(mSearchApiServer.StartError))
			{
				mHost.MainWindow.BeginInvoke((Action)ShowApiStartupMessage);
			}

			return true;
		}

		public override void Terminate()
		{
			GlobalWindowManager.WindowAdded -= OnWindowAdded;
			StopApiServer();
			SearchApiSettings.Save(mHost);
			SearchSettings.Save(mHost);
			base.Terminate();
		}

		private void OnWindowAdded(object sender, GwmWindowEventArgs e)
		{
			var optionsForm = e.Form as OptionsForm;
			if (optionsForm != null)
			{
				HttpsTypeSearchOptions.AddToWindow(optionsForm, ApplyUpdatedSettings);
			}
		}

		private void ApplyUpdatedSettings()
		{
			SearchSettings.Save(mHost);
			SearchApiSettings.Save(mHost);
			RestartApiServer();
		}

		private void RestartApiServer()
		{
			StopApiServer();
			mSearchApiServer = new SearchApiServer(mHost);
			mSearchApiServer.Start();
		}

		private void StopApiServer()
		{
			if (mSearchApiServer != null)
			{
				mSearchApiServer.Stop();
				mSearchApiServer = null;
			}
		}

		private void ShowApiStartupMessage()
		{
			if (mSearchApiServer != null && !String.IsNullOrEmpty(mSearchApiServer.StartError))
			{
				MessageBox.Show(mHost.MainWindow,
					"HttpsTypeSearch API failed to start.\n\n" + mSearchApiServer.StartError,
					PwDefs.ShortProductName + " - HttpsTypeSearch API",
					MessageBoxButtons.OK,
					MessageBoxIcon.Warning);
				return;
			}

			if (SearchApiSettings.TokenWasGenerated)
			{
				MessageBox.Show(mHost.MainWindow,
					"HttpsTypeSearch API token generated.\n\nListen Prefixes:\n" + String.Join("\n", SearchApiSettings.GetPrefixes().ToArray()) +
					"\n\nBearer Token:\n" + SearchApiSettings.ApiToken,
					PwDefs.ShortProductName + " - HttpsTypeSearch API",
					MessageBoxButtons.OK,
					MessageBoxIcon.Information);
			}
		}
	}
}

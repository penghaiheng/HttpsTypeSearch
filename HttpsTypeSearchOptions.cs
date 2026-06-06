using System;
using System.Drawing;
using System.Linq;
using System.Windows.Forms;
using KeePass.Forms;
using KeePassLib;

namespace HttpsTypeSearch
{
	internal sealed class HttpsTypeSearchOptions : UserControl
	{
		private const int ContentPadding = 8;
		private const int LabelWidth = 104;
		private const int ButtonWidth = 132;
		private const int RowHeight = 24;
		private const int RowGap = 6;
		private const int GroupGap = 8;
		private const int BottomPadding = 20;

		private readonly Action mApplyChanges;
		private readonly Panel mScrollPanel = new Panel();
		private readonly Panel mContentPanel = new Panel();
		private readonly GroupBox mApiGroup = new GroupBox();
		private readonly GroupBox mSearchGroup = new GroupBox();
		private readonly CheckBox mEnabledCheckBox = new CheckBox();
		private readonly TextBox mAddressesTextBox = new TextBox();
		private readonly Label mAddressesHintLabel = new Label();
		private readonly NumericUpDown mPortNumeric = new NumericUpDown();
		private readonly NumericUpDown mMaxResultsNumeric = new NumericUpDown();
		private readonly CheckBox mAllowSensitiveCheckBox = new CheckBox();
		private readonly CheckBox mReturnPasswordsCheckBox = new CheckBox();
		private readonly CheckBox mReturnOtpCurrentCheckBox = new CheckBox();
		private readonly TextBox mTokenTextBox = new TextBox();
		private readonly Button mRegenerateTokenButton = new Button();
		private readonly Button mRegenerateCertificateButton = new Button();
		private readonly Label mCertificateStateLabel = new Label();
		private readonly CheckBox mSearchTitle = new CheckBox();
		private readonly CheckBox mSearchUserName = new CheckBox();
		private readonly CheckBox mSearchUrl = new CheckBox();
		private readonly CheckBox mSearchNotes = new CheckBox();
		private readonly CheckBox mSearchTags = new CheckBox();
		private readonly CheckBox mSearchCustomFields = new CheckBox();
		private readonly CheckBox mCaseSensitive = new CheckBox();
		private readonly CheckBox mExcludeExpired = new CheckBox();
		private readonly CheckBox mResolveReferences = new CheckBox();
		private bool mForceCertificateRecreate;

		public HttpsTypeSearchOptions(Action applyChanges)
		{
			mApplyChanges = applyChanges;
			InitializeLayout();
			LoadCurrentValues();
		}

		public static void AddToWindow(OptionsForm optionsForm, Action applyChanges)
		{
			var tabControl = optionsForm.Controls.Find("m_tabMain", false).FirstOrDefault() as TabControl;
			var okButton = optionsForm.Controls.Find("m_btnOK", false).FirstOrDefault() as Button;

			if (tabControl == null || okButton == null) return;

			var tabPage = new TabPage("HttpsTypeSearch");
			tabPage.UseVisualStyleBackColor = true;
			tabPage.ImageIndex = (int)PwIcon.EMailSearch;

			var options = new HttpsTypeSearchOptions(applyChanges);
			options.Dock = DockStyle.Fill;
			tabPage.Controls.Add(options);
			tabControl.TabPages.Add(tabPage);

			okButton.Click += delegate { options.ApplySettings(); };
		}

		private void InitializeLayout()
		{
			Dock = DockStyle.Fill;
			mScrollPanel.Dock = DockStyle.Fill;
			mScrollPanel.AutoScroll = true;
			mScrollPanel.Padding = new Padding(0);
			mScrollPanel.Resize += delegate { LayoutContent(); };
			Controls.Add(mScrollPanel);

			mContentPanel.Location = new Point(0, 0);
			mContentPanel.Margin = new Padding(0);
			mScrollPanel.Controls.Add(mContentPanel);

			ConfigureApiGroup();
			ConfigureSearchGroup();
			mContentPanel.Controls.Add(mApiGroup);
			mContentPanel.Controls.Add(mSearchGroup);
			LayoutContent();
		}

		private void ConfigureApiGroup()
		{
			mApiGroup.Text = "API";
			mApiGroup.SuspendLayout();

			mEnabledCheckBox.Text = "Enable HTTPS API";
			mEnabledCheckBox.AutoSize = true;
			mApiGroup.Controls.Add(mEnabledCheckBox);

			mApiGroup.Controls.Add(CreateLabel("Listen addresses", 16, 50));
			mAddressesTextBox.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
			mApiGroup.Controls.Add(mAddressesTextBox);
			mAddressesHintLabel.Text = "Use localhost;127.0.0.1";
			mAddressesHintLabel.AutoSize = true;
			mAddressesHintLabel.ForeColor = SystemColors.GrayText;
			mApiGroup.Controls.Add(mAddressesHintLabel);

			mApiGroup.Controls.Add(CreateLabel("Port", 16, 100));
			mPortNumeric.Minimum = 1;
			mPortNumeric.Maximum = 65535;
			mPortNumeric.Width = 100;
			mApiGroup.Controls.Add(mPortNumeric);

			mApiGroup.Controls.Add(CreateLabel("Max results", 230, 100));
			mMaxResultsNumeric.Minimum = 1;
			mMaxResultsNumeric.Maximum = 500;
			mMaxResultsNumeric.Width = 100;
			mApiGroup.Controls.Add(mMaxResultsNumeric);

			mAllowSensitiveCheckBox.Text = "Enable password endpoint";
			mAllowSensitiveCheckBox.AutoSize = true;
			mApiGroup.Controls.Add(mAllowSensitiveCheckBox);

			mReturnPasswordsCheckBox.Text = "Include password in search results";
			mReturnPasswordsCheckBox.AutoSize = true;
			mApiGroup.Controls.Add(mReturnPasswordsCheckBox);

			mReturnOtpCurrentCheckBox.Text = "Include OTP in search results";
			mReturnOtpCurrentCheckBox.AutoSize = true;
			mApiGroup.Controls.Add(mReturnOtpCurrentCheckBox);

			mApiGroup.Controls.Add(CreateLabel("API token", 16, 156));
			mTokenTextBox.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
			mApiGroup.Controls.Add(mTokenTextBox);
			mRegenerateTokenButton.Text = "Regenerate token";
			mRegenerateTokenButton.Size = new Size(ButtonWidth, 23);
			mRegenerateTokenButton.Click += delegate
			{
				SearchApiSettings.RegenerateToken();
				mTokenTextBox.Text = SearchApiSettings.ApiToken;
			};
			mApiGroup.Controls.Add(mRegenerateTokenButton);

			mApiGroup.Controls.Add(CreateLabel("Certificate", 16, 186));
			mCertificateStateLabel.Text = "Current certificate will be reused.";
			mCertificateStateLabel.AutoEllipsis = true;
			mCertificateStateLabel.TextAlign = ContentAlignment.MiddleLeft;
			mApiGroup.Controls.Add(mCertificateStateLabel);
			mRegenerateCertificateButton.Text = "Regenerate certificate";
			mRegenerateCertificateButton.Size = new Size(ButtonWidth, 23);
			mRegenerateCertificateButton.Click += delegate
			{
				mForceCertificateRecreate = true;
				mCertificateStateLabel.Text = "A new certificate will be created after you click OK.";
			};
			mApiGroup.Controls.Add(mRegenerateCertificateButton);

			mApiGroup.ResumeLayout(false);
		}

		private void ConfigureSearchGroup()
		{
			mSearchGroup.Text = "Search";
			mSearchGroup.SuspendLayout();

			ConfigureCheckBox(mSearchTitle, "Title");
			ConfigureCheckBox(mSearchUserName, "UserName");
			ConfigureCheckBox(mSearchUrl, "Url");
			ConfigureCheckBox(mSearchNotes, "Notes");
			ConfigureCheckBox(mSearchTags, "Tags");
			ConfigureCheckBox(mSearchCustomFields, "Custom fields");
			ConfigureCheckBox(mCaseSensitive, "Case sensitive");
			ConfigureCheckBox(mExcludeExpired, "Exclude expired");
			ConfigureCheckBox(mResolveReferences, "Resolve references");

			mSearchGroup.Controls.Add(mSearchTitle);
			mSearchGroup.Controls.Add(mSearchUserName);
			mSearchGroup.Controls.Add(mSearchUrl);
			mSearchGroup.Controls.Add(mSearchNotes);
			mSearchGroup.Controls.Add(mSearchTags);
			mSearchGroup.Controls.Add(mSearchCustomFields);
			mSearchGroup.Controls.Add(mCaseSensitive);
			mSearchGroup.Controls.Add(mExcludeExpired);
			mSearchGroup.Controls.Add(mResolveReferences);

			mSearchGroup.ResumeLayout(false);
		}

		private void LayoutContent()
		{
			var contentWidth = Math.Max(520, mScrollPanel.ClientSize.Width - 1);

			var groupWidth = Math.Max(504, contentWidth - (ContentPadding * 2));
			mApiGroup.SetBounds(ContentPadding, ContentPadding, groupWidth, 272);
			mSearchGroup.SetBounds(ContentPadding, mApiGroup.Bottom + GroupGap, groupWidth, 84);

			LayoutApiGroup(groupWidth);
			LayoutSearchGroup(groupWidth);
			mContentPanel.Size = new Size(contentWidth, mSearchGroup.Bottom + BottomPadding);
		}

		private void LayoutApiGroup(int groupWidth)
		{
			const int left = 16;
			const int top = 22;
			const int rightPadding = 14;
			var editorLeft = left + LabelWidth + 10;
			var buttonLeft = groupWidth - rightPadding - ButtonWidth;
			var editorWidth = Math.Max(140, buttonLeft - editorLeft - 8);
			var y = top;

			mEnabledCheckBox.Location = new Point(left, y);
			y += RowHeight + RowGap;

			mAddressesTextBox.SetBounds(editorLeft, y - 2, groupWidth - editorLeft - rightPadding, 23);
			mAddressesHintLabel.Location = new Point(editorLeft, y + RowHeight - 2);
			y += RowHeight + 18;

			mPortNumeric.Location = new Point(editorLeft, y - 2);
			mMaxResultsNumeric.Location = new Point(314, y - 2);
			y += RowHeight + RowGap;

			mAllowSensitiveCheckBox.Location = new Point(left, y);
			y += RowHeight + RowGap;

			mReturnPasswordsCheckBox.Location = new Point(left, y);
			y += RowHeight + RowGap;

			mReturnOtpCurrentCheckBox.Location = new Point(left, y);
			y += RowHeight + RowGap;

			mTokenTextBox.SetBounds(editorLeft, y - 2, editorWidth, 23);
			mRegenerateTokenButton.Location = new Point(buttonLeft, y - 2);
			y += RowHeight + RowGap;

			mCertificateStateLabel.SetBounds(editorLeft, y, editorWidth, 26);
			mRegenerateCertificateButton.Location = new Point(buttonLeft, y - 2);
		}

		private void LayoutSearchGroup(int groupWidth)
		{
			var columns = new[] { 16, 130, 244, 358 };
			var row1 = 24;
			var row2 = 48;

			mSearchTitle.Location = new Point(columns[0], row1);
			mSearchUserName.Location = new Point(columns[1], row1);
			mSearchUrl.Location = new Point(columns[2], row1);
			mSearchNotes.Location = new Point(columns[3], row1);

			mSearchTags.Location = new Point(columns[0], row2);
			mSearchCustomFields.Location = new Point(columns[1], row2);
			mCaseSensitive.Location = new Point(columns[2], row2);
			mExcludeExpired.Location = new Point(columns[3], row2);

			mResolveReferences.Location = new Point(columns[0], 72);
			mSearchGroup.Height = 100;
			if (groupWidth < 520)
			{
				mSearchGroup.Height = 122;
				mResolveReferences.Location = new Point(columns[1], 72);
			}
		}

		private static Label CreateLabel(string text, int x, int y)
		{
			var label = new Label();
			label.Text = text;
			label.AutoSize = true;
			label.Location = new Point(x, y + 3);
			return label;
		}

		private static void ConfigureCheckBox(CheckBox checkBox, string text)
		{
			checkBox.Text = text;
			checkBox.AutoSize = true;
			checkBox.Margin = new Padding(0);
		}

		private void LoadCurrentValues()
		{
			mEnabledCheckBox.Checked = SearchApiSettings.Enabled;
			mAddressesTextBox.Text = SearchApiSettings.ListenAddresses;
			mPortNumeric.Value = SearchApiSettings.Port;
			mMaxResultsNumeric.Value = SearchApiSettings.MaxResults;
			mAllowSensitiveCheckBox.Checked = SearchApiSettings.AllowSensitiveEndpoints;
			mReturnPasswordsCheckBox.Checked = SearchApiSettings.ReturnPasswords;
			mReturnOtpCurrentCheckBox.Checked = SearchApiSettings.ReturnOtpCurrent;
			mTokenTextBox.Text = SearchApiSettings.ApiToken;
			mSearchTitle.Checked = SearchSettings.SearchTitle;
			mSearchUserName.Checked = SearchSettings.SearchUserName;
			mSearchUrl.Checked = SearchSettings.SearchUrl;
			mSearchNotes.Checked = SearchSettings.SearchNotes;
			mSearchTags.Checked = SearchSettings.SearchTags;
			mSearchCustomFields.Checked = SearchSettings.SearchCustomFields;
			mCaseSensitive.Checked = SearchSettings.CaseSensitive;
			mExcludeExpired.Checked = SearchSettings.ExcludeExpired;
			mResolveReferences.Checked = SearchSettings.ResolveReferences;
		}

		private void ApplySettings()
		{
			SearchApiSettings.Apply(
				mEnabledCheckBox.Checked,
				mAddressesTextBox.Text,
				Decimal.ToInt32(mPortNumeric.Value),
				mTokenTextBox.Text,
				mAllowSensitiveCheckBox.Checked,
				mReturnPasswordsCheckBox.Checked,
				mReturnOtpCurrentCheckBox.Checked,
				Decimal.ToInt32(mMaxResultsNumeric.Value));

			SearchSettings.Apply(
				mSearchTitle.Checked,
				mSearchUserName.Checked,
				mSearchUrl.Checked,
				mSearchNotes.Checked,
				mSearchCustomFields.Checked,
				mSearchTags.Checked,
				mCaseSensitive.Checked,
				mExcludeExpired.Checked,
				mResolveReferences.Checked);

			if (mForceCertificateRecreate)
			{
				try
				{
					HttpsCertificateManager.EnsureBindings(SearchApiSettings.GetPrefixes(), true);
					mCertificateStateLabel.Text = "Certificate regenerated successfully.";
					mForceCertificateRecreate = false;
				}
				catch (Exception ex)
				{
					MessageBox.Show(this, ex.Message, PwDefs.ShortProductName + " - HttpsTypeSearch", MessageBoxButtons.OK, MessageBoxIcon.Warning);
				}
			}

			if (mApplyChanges != null) mApplyChanges();
		}
	}
}

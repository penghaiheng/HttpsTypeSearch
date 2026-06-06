using System;
using System.Reflection;
using System.Windows.Forms;
using KeePass.Forms;
using KeePass.Util.Spr;
using KeePassLib;

namespace HttpsTypeSearch
{
	internal static class EntryFieldReader
	{
		internal const string TagsVirtualFieldName = "***TAGS***";
		private static readonly string[] OtpPlaceholders = { "{TIMEOTP}", "{TOTP}", "{HMACOTP}" };
		private const SprCompileFlags OtpCompileFlags = SprCompileFlags.OtpNonActive | SprCompileFlags.HmacOtp;
		private static readonly MethodInfo OtpLoadSettingsMethod = typeof(OtpGeneratorForm).GetMethod("LoadSettings", BindingFlags.Instance | BindingFlags.NonPublic);
		private static readonly MethodInfo OtpUpdatePreviewsMethod = typeof(OtpGeneratorForm).GetMethod("UpdatePreviews", BindingFlags.Instance | BindingFlags.NonPublic);
		private static readonly FieldInfo OtpPreviewValueField = typeof(OtpGeneratorForm).GetField("m_lblTotpPreviewValue", BindingFlags.Instance | BindingFlags.NonPublic);

		internal static string ReadFieldValue(PwDatabase context, PwEntry entry, string fieldName, bool resolveReferences)
		{
			return ReadFieldValue(context, entry, fieldName, resolveReferences, false);
		}

		internal static string ReadApiFieldValue(PwDatabase context, PwEntry entry, string fieldName, bool resolveReferences, bool forcePlainTextPasswords)
		{
			return ReadFieldValue(context, entry, fieldName, resolveReferences, forcePlainTextPasswords);
		}

		internal static string ReadCurrentOtpValue(PwDatabase context, PwEntry entry)
		{
			foreach (var placeholder in OtpPlaceholders)
			{
				var value = CompileOtpValue(context, entry, placeholder);
				if (!string.IsNullOrEmpty(value) && value != placeholder)
				{
					return value;
				}
			}

			var directValue = ReadCurrentOtpValueViaOtpForm(context, entry);
			if (!string.IsNullOrEmpty(directValue))
			{
				return directValue;
			}

			return null;
		}

		private static string ReadFieldValue(PwDatabase context, PwEntry entry, string fieldName, bool resolveReferences, bool forcePlainTextPasswords)
		{
			var fieldValue = forcePlainTextPasswords ? entry.Strings.ReadSafe(fieldName) : entry.Strings.ReadSafeEx(fieldName);
			if (resolveReferences && fieldValue.IndexOf('{') >= 0)
			{
				return CompileValue(context, entry, fieldValue, forcePlainTextPasswords);
			}

			return fieldValue;
		}

		private static string CompileValue(PwDatabase context, PwEntry entry, string value, bool forcePlainTextPasswords)
		{
			var sprContext = new SprContext(entry, context, SprCompileFlags.Deref) { ForcePlainTextPasswords = forcePlainTextPasswords };
			return SprEngine.Compile(value, sprContext);
		}

		private static string CompileOtpValue(PwDatabase context, PwEntry entry, string placeholder)
		{
			var sprContext = new SprContext(entry, context, OtpCompileFlags);
			return SprEngine.Compile(placeholder, sprContext);
		}

		private static string ReadCurrentOtpValueViaOtpForm(PwDatabase context, PwEntry entry)
		{
			if (OtpLoadSettingsMethod == null || OtpUpdatePreviewsMethod == null || OtpPreviewValueField == null)
			{
				return null;
			}

			try
			{
				using (var form = new OtpGeneratorForm())
				{
					form.InitEx(entry.Strings, context);
					OtpLoadSettingsMethod.Invoke(form, new object[] { entry.Strings, true, true });
					OtpUpdatePreviewsMethod.Invoke(form, null);

					var previewLabel = OtpPreviewValueField.GetValue(form) as Label;
					var value = (previewLabel != null ? previewLabel.Text : string.Empty);
					return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
				}
			}
			catch
			{
				return null;
			}
		}
	}
}
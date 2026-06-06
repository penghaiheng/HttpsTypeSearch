using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Security.Cryptography.X509Certificates;
using System.Text;

namespace HttpsTypeSearch
{
	internal static class HttpsCertificateManager
	{
		private const string CertificateFriendlyName = "HttpsTypeSearch Local API";
		private const string CertificateSubject = "CN=localhost";
		private const string AppId = "{F4F4DC8A-5EA7-4A1B-9211-0E1AD273DB01}";

		public static void EnsureBindings(IEnumerable<string> prefixes, bool forceRecreate)
		{
			if (prefixes == null) return;

			var ports = new HashSet<int>();
			foreach (var prefix in prefixes)
			{
				Uri uri;
				if (!Uri.TryCreate(prefix, UriKind.Absolute, out uri)) continue;
				if (!String.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase)) continue;

				if (ports.Add(uri.Port) && (forceRecreate || NeedsProvisioning(uri.Port)))
				{
					ProvisionBindings(uri.Port, forceRecreate);
				}
			}
		}

		private static bool NeedsProvisioning(int port)
		{
			return !HasLocalCertificate() || !HasBinding("ipport", "127.0.0.1:" + port) || !HasBinding("hostnameport", "localhost:" + port);
		}

		private static bool HasLocalCertificate()
		{
			using (var store = new X509Store(StoreName.My, StoreLocation.LocalMachine))
			{
				store.Open(OpenFlags.ReadOnly);
				return store.Certificates.Cast<X509Certificate2>().Any(delegate(X509Certificate2 cert)
				{
					return String.Equals(cert.FriendlyName, CertificateFriendlyName, StringComparison.Ordinal) &&
						String.Equals(cert.Subject, CertificateSubject, StringComparison.OrdinalIgnoreCase) &&
						cert.HasPrivateKey;
				});
			}
		}

		private static bool HasBinding(string bindingType, string bindingValue)
		{
			var startInfo = new ProcessStartInfo
			{
				FileName = "netsh.exe",
				Arguments = String.Format("http show sslcert {0}={1}", bindingType, bindingValue),
				UseShellExecute = false,
				CreateNoWindow = true,
				RedirectStandardOutput = true,
				RedirectStandardError = true
			};

			using (var process = Process.Start(startInfo))
			{
				if (process == null) return false;
				process.WaitForExit();
				return process.ExitCode == 0;
			}
		}

		private static void ProvisionBindings(int port, bool forceRecreate)
		{
			var scriptPath = Path.Combine(Path.GetTempPath(), "HttpsTypeSearch-EnsureHttps.ps1");
			File.WriteAllText(scriptPath, GetScript(), Encoding.UTF8);

			try
			{
				var arguments = String.Format("-NoProfile -ExecutionPolicy Bypass -File \"{0}\" -Port {1}{2}",
					scriptPath,
					port,
					forceRecreate ? " -ForceRecreate" : String.Empty);

				var startInfo = new ProcessStartInfo
				{
					FileName = "powershell.exe",
					Arguments = arguments,
					UseShellExecute = true,
					Verb = "runas",
					WindowStyle = ProcessWindowStyle.Hidden
				};

				using (var process = Process.Start(startInfo))
				{
					if (process == null)
					{
						throw new InvalidOperationException("Failed to start HTTPS certificate provisioning process.");
					}

					process.WaitForExit();
					if (process.ExitCode != 0)
					{
						throw new InvalidOperationException("HTTPS certificate provisioning failed. Approve the UAC prompt and retry.");
					}
				}
			}
			catch (Win32Exception ex)
			{
				throw new InvalidOperationException("HTTPS certificate provisioning was cancelled or blocked.", ex);
			}
			finally
			{
				try { File.Delete(scriptPath); }
				catch (Exception) { }
			}
		}

		private static string GetScript()
		{
			return @"
param(
    [int]$Port,
    [switch]$ForceRecreate
)

$ErrorActionPreference = 'Stop'
$friendlyName = 'HttpsTypeSearch Local API'
$subject = 'CN=localhost'

$existing = Get-ChildItem Cert:\LocalMachine\My |
    Where-Object { $_.Subject -eq $subject -and $_.FriendlyName -eq $friendlyName } |
    Sort-Object NotAfter -Descending |
    Select-Object -First 1

if ($ForceRecreate -and $existing) {
    Remove-Item -Path ('Cert:\LocalMachine\My\' + $existing.Thumbprint) -Force
    $existing = $null
}

if (-not $existing) {
    $existing = New-SelfSignedCertificate `
        -DnsName 'localhost', '127.0.0.1' `
        -CertStoreLocation 'Cert:\LocalMachine\My' `
        -FriendlyName $friendlyName `
        -NotAfter (Get-Date).AddYears(5) `
        -KeyAlgorithm RSA `
        -KeyLength 2048 `
        -HashAlgorithm SHA256
}

$rootStore = New-Object System.Security.Cryptography.X509Certificates.X509Store('Root', 'CurrentUser')
$rootStore.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
try {
    $trusted = $rootStore.Certificates.Find(
        [System.Security.Cryptography.X509Certificates.X509FindType]::FindByThumbprint,
        $existing.Thumbprint,
        $false)

    if ($trusted.Count -eq 0) {
        $rootStore.Add($existing)
    }
}
finally {
    $rootStore.Close()
}


$appid = '{F4F4DC8A-5EA7-4A1B-9211-0E1AD273DB01}'
$ipPort = '127.0.0.1:' + $Port
$hostPort = 'localhost:' + $Port

& netsh http delete sslcert ipport=$ipPort | Out-Null
if ($LASTEXITCODE -gt 1) {
	throw 'Failed to remove previous IP HTTPS binding.'
}

& netsh http add sslcert ipport=$ipPort certhash=$($existing.Thumbprint) certstorename=MY appid=$appid | Out-Null
if ($LASTEXITCODE -ne 0) {
	throw 'Failed to add IP HTTPS binding.'
}

& netsh http delete sslcert hostnameport=$hostPort | Out-Null
if ($LASTEXITCODE -gt 1) {
	throw 'Failed to remove previous localhost HTTPS binding.'
}

& netsh http add sslcert hostnameport=$hostPort certhash=$($existing.Thumbprint) certstorename=MY appid=$appid | Out-Null
if ($LASTEXITCODE -ne 0) {
	throw 'Failed to add localhost HTTPS binding.'
}
";
		}
	}
}
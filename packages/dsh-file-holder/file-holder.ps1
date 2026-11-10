param([Parameter(Mandatory = $true)][string]$Path)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$exitCode = 0
try {
    Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

namespace DshFileHolder {
    [StructLayout(LayoutKind.Sequential)]
    public struct UniqueProcess {
        public uint ProcessId;
        public System.Runtime.InteropServices.ComTypes.FILETIME StartTime;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct ProcessInfo {
        public UniqueProcess Process;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)] public string AppName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 64)] public string ServiceName;
        public uint ApplicationType;
        public uint AppStatus;
        public uint TerminalSessionId;
        [MarshalAs(UnmanagedType.Bool)] public bool Restartable;
    }

    public sealed class Holder {
        public string name;
        public uint pid;
        public uint applicationType;
        public string serviceName;
    }

    public static class Query {
        [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)]
        private static extern uint RmStartSession(out uint session, uint flags, StringBuilder key);
        [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)]
        private static extern uint RmRegisterResources(uint session, uint files,
            [In, MarshalAs(UnmanagedType.LPArray, ArraySubType = UnmanagedType.LPWStr)] string[] names,
            uint applications, IntPtr processes, uint services, IntPtr serviceNames);
        [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)]
        private static extern uint RmGetList(uint session, out uint needed, ref uint count,
            [In, Out] ProcessInfo[] processes, ref uint reasons);
        [DllImport("rstrtmgr.dll")]
        private static extern uint RmEndSession(uint session);

        private static void Check(uint code, string stage) {
            if (code != 0) throw new InvalidOperationException(stage + " failed (" + code + ").");
        }

        public static Holder[] Run(string path) {
            uint session;
            Check(RmStartSession(out session, 0, new StringBuilder(33)), "RmStartSession");
            try {
                Check(RmRegisterResources(session, 1, new string[] { path }, 0, IntPtr.Zero, 0, IntPtr.Zero), "RmRegisterResources");
                uint needed, count = 0, reasons = 0;
                uint code = RmGetList(session, out needed, ref count, null, ref reasons);
                if (code == 0 && needed == 0) return new Holder[0];
                if (code != 234) Check(code, "RmGetList size");
                if (needed == 0 || needed > 1024) throw new InvalidOperationException("Process list exceeds limit.");
                ProcessInfo[] entries = new ProcessInfo[needed];
                count = needed;
                // Exactly one allocation/read after the size probe. No automatic retries.
                Check(RmGetList(session, out needed, ref count, entries, ref reasons), "RmGetList read");
                List<Holder> result = new List<Holder>();
                for (int i = 0; i < count; i++) {
                    ProcessInfo item = entries[i];
                    result.Add(new Holder {
                        name = String.IsNullOrWhiteSpace(item.AppName) ? "Unknown application" : item.AppName,
                        pid = item.Process.ProcessId, applicationType = item.ApplicationType,
                        serviceName = item.ServiceName ?? ""
                    });
                }
                return result.ToArray();
            } finally {
                Check(RmEndSession(session), "RmEndSession");
            }
        }
    }
}
"@
    $holders = @([DshFileHolder.Query]::Run($Path))
    $payload = [ordered]@{
        version = 1
        ok = $true
        observedAt = [DateTime]::UtcNow.ToString('o')
        processes = @($holders | ForEach-Object {
            [ordered]@{ name = $_.name; pid = $_.pid; applicationType = $_.applicationType; serviceName = $_.serviceName }
        })
    }
} catch {
    # Never emit exception stacks, user paths, or raw compiler diagnostics.
    $reason = 'Restart Manager or Add-Type failed.'
    $detail = $_.Exception.GetBaseException().Message
    if ($detail -match '^(Rm(StartSession|RegisterResources|GetList size|GetList read|EndSession) failed \([0-9]+\)\.|Process list exceeds limit\.)$') {
        $reason = $detail
    }
    $payload = [ordered]@{ version = 1; ok = $false; error = $reason }
    $exitCode = 1
}
[Console]::Out.WriteLine(($payload | ConvertTo-Json -Depth 5 -Compress))
exit $exitCode

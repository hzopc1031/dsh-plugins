# Third-party notices

The PE parser, test fixture generator, icon, and plugin implementation are original MIT-licensed code in this repository. No Windows/system/third-party EXE or DLL is included. All test PE bytes are generated from original source at runtime.

The plugin uses the host-provided @deepseek-ai/cordis, @deepseek-ai/schemastery, @deepseek-ai/dsh-commands, @deepseek-ai/dsh-subprocess and @deepseek-ai/dsh-working-directory interfaces (MIT). They are peer dependencies, not bundled copies. Development dependencies retain their own notices in their installed packages.

Optional integration: lucasg/Dependencies, https://github.com/lucasg/Dependencies (MIT; its own dependencies carry their respective licenses). Users must supply their own trusted CLI executable and comply with its notices. No Dependencies code or binary is redistributed. The CLI argument and JSON field names are interoperability facts taken from its documented source interface.

Microsoft Windows, Visual C++, DirectX and .NET names identify external products. No Microsoft binary or runtime is redistributed. Suggested runtime installation is text only; this plugin offers no download or installation action.

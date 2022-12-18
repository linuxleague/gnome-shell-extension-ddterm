#!/usr/bin/env gjs

/*
    Copyright © 2022 Aleksandr Mezin

    This file is part of ddterm GNOME Shell extension.

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

'use strict';

const ByteArray = imports.byteArray;
const System = imports.system;

const { Gio, GIRepository, PackageKitGlib } = imports.gi;

const APP_DATA_DIR = Gio.File.new_for_commandline_arg(System.programInvocationName).get_parent();
imports.searchPath.unshift(APP_DATA_DIR.get_path());

const Me = imports.misc.extensionUtils.getCurrentExtension();
Me.dir = APP_DATA_DIR;

const { dependencies } = imports;

function update_manifest(dry_run = false) {
    const manifest = dependencies.load_manifest();
    const os_ids = dependencies.get_os_ids();
    const client = PackageKitGlib.Client.new();
    let updated = false;

    for (const [lib, lib_manifest] of Object.entries(manifest)) {
        for (const [version, version_manifest] of Object.entries(lib_manifest)) {
            imports.gi.versions[lib] = version;
            const discard_ = imports.gi[lib];

            const filename = GIRepository.Repository.get_default().get_typelib_path(lib);

            const found = client.search_files(
                1 << PackageKitGlib.FilterEnum.INSTALLED,
                [filename],
                null,
                () => {}
            ).get_package_array();

            if (found.length === 0)
                throw new Error(`Can't find package for file ${filename}`);

            if (found.length > 1) {
                throw new Error(
                    `Multiple packages found for ${filename}: ` +
                    `${found.map(p => p.get_id()).join(', ')}`
                );
            }

            const package_name = found[0].get_name();
            const resolved = dependencies.resolve_package(version_manifest, os_ids);

            printerr(`${filename} found package: ${package_name} manifest: ${resolved}`);

            if (resolved !== package_name) {
                version_manifest[os_ids[0]] = package_name;
                updated = true;
            }
        }
    }

    if (!dry_run) {
        dependencies.MANIFEST_FILE.replace_contents(
            ByteArray.fromString(JSON.stringify(manifest, undefined, 1)),
            null,
            false,
            Gio.FileCreateFlags.NONE,
            null
        );
    }

    return updated;
}

const check = ARGV.includes('--dry-run') || ARGV.includes('-n');
const diff = update_manifest(check);

System.exit(check && diff ? 1 : 0);

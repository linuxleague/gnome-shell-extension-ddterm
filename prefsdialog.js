/*
    Copyright © 2020, 2021 Aleksandr Mezin

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

/* exported PrefsDialog */

const { GObject, Gtk } = imports.gi;
const { PrefsWidget } = imports.prefs;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const { settings } = Me.imports;

var PrefsDialog = GObject.registerClass(
    {
        Template: Me.dir.get_child('prefsdialog.ui').get_uri(),
        Properties: {
            settings: GObject.ParamSpec.object('settings', '', '', GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT_ONLY, settings.Settings),
        },
    },
    class PrefsDialog extends Gtk.Dialog {
        _init(params) {
            super._init(params);

            this.get_content_area().add(new PrefsWidget({
                settings: this.settings,
            }));
        }
    }
);

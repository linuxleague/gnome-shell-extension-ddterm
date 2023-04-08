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

const { GObject, Gdk, Gtk } = imports.gi;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const { backport } = Me.imports.ddterm;
const { util } = Me.imports.ddterm.pref;
const { translations } = Me.imports.ddterm.util;

const IS_GTK3 = Gtk.get_major_version() === 3;

function accelerator_parse(accel) {
    const parsed = Gtk.accelerator_parse(accel);

    return IS_GTK3 ? parsed : parsed.slice(1);
}

const COLUMN_SETTINGS_KEY = 0;
const COLUMN_ACCEL_KEY = 2;
const COLUMN_ACCEL_MODS = 3;
const COLUMN_EDITABLE = 4;

var Widget = backport.GObject.registerClass(
    {
        GTypeName: 'DDTermPrefsShortcuts',
        Template: util.ui_file_uri('prefs-shortcuts.ui'),
        Children: [
            'accel_renderer',
            'global_accel_renderer',
            'shortcuts_list',
            'global_shortcuts_list',
            'shortcuts_treeview',
        ],
        Properties: {
            'settings': GObject.ParamSpec.object(
                'settings',
                '',
                '',
                GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT_ONLY,
                Me.imports.ddterm.settings.gui.Settings
            ),
        },
    },
    class PrefsShortcuts extends Gtk.Box {
        _init(params) {
            super._init(params);

            this.insert_action_group(
                'settings',
                this.settings.create_action_group([
                    'shortcuts-enabled',
                ])
            );

            [this.shortcuts_list, this.global_shortcuts_list].forEach(shortcuts_list => {
                shortcuts_list.foreach((model, path, iter) => {
                    const i = iter.copy();
                    const key = model.get_value(i, COLUMN_SETTINGS_KEY);
                    const meta = this.settings.meta[key];

                    const handler = this.settings.connect(
                        `changed::${key}`,
                        this.update_model.bind(this, model, key, i)
                    );
                    this.connect('destroy', () => this.settings.disconnect(handler));
                    this.update_model(model, key, i);

                    const editable_handler = meta.connect(
                        'notify::editable',
                        this.update_editable.bind(this, model, i)
                    );
                    this.connect('destroy', () => meta.disconnect(editable_handler));
                    this.update_editable(model, i, meta);

                    return false;
                });
            });

            for (const signal of ['accel-edited', 'accel-cleared']) {
                this.accel_renderer.connect(
                    signal,
                    this.save_shortcut.bind(this, this.shortcuts_list)
                );

                this.global_accel_renderer.connect(
                    signal,
                    this.save_shortcut.bind(this, this.global_shortcuts_list)
                );
            }

            this.global_accel_renderer.connect(
                'editing-started',
                (IS_GTK3 ? this.grab_global_keys : this.inhibit_system_shortcuts).bind(this)
            );

            this.settings.bind_property(
                'shortcuts-enabled',
                this.shortcuts_treeview,
                'sensitive',
                GObject.BindingFlags.SYNC_CREATE
            );
        }

        get title() {
            return translations.gettext('Keyboard Shortcuts');
        }

        update_model(model, key, iter) {
            const strv = this.settings.get_strv(key);
            const [accel_key, accel_mods] =
                strv.length > 0 ? accelerator_parse(strv[0]) : [0, 0];

            model.set(
                iter,
                [COLUMN_ACCEL_KEY, COLUMN_ACCEL_MODS],
                [accel_key, accel_mods]
            );
        }

        update_editable(model, iter, meta) {
            model.set_value(iter, COLUMN_EDITABLE, meta.editable);
        }

        save_shortcut(shortcuts_list, _, path, accel_key = null, accel_mods = null) {
            const [ok, iter] = shortcuts_list.get_iter_from_string(path);
            if (!ok)
                return;

            const action = shortcuts_list.get_value(iter, COLUMN_SETTINGS_KEY);
            const key_names = accel_key ? [Gtk.accelerator_name(accel_key, accel_mods)] : [];
            this.settings[action] = key_names;
        }

        grab_global_keys(cell_renderer, editable) {
            const display = this.window.get_display();
            const seat = display.get_default_seat();
            const status = seat.grab(
                this.window,
                Gdk.SeatCapabilities.KEYBOARD,
                false,
                null,
                null,
                null
            );

            if (status !== Gdk.GrabStatus.SUCCESS)
                return;

            const done_handler = editable.connect('editing-done', () => {
                seat.ungrab();
                editable.disconnect(done_handler);
            });
        }

        inhibit_system_shortcuts(cell_renderer, editable) {
            const toplevel = this.root.get_surface();
            toplevel.inhibit_system_shortcuts(null);

            const done_handler = editable.connect('editing-done', () => {
                toplevel.restore_system_shortcuts();
                editable.disconnect(done_handler);
            });
        }
    }
);

/* exported Widget */

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

/* exported init buildPrefsWidget */

const Me = imports.misc.extensionUtils.getCurrentExtension();

function init() {
    imports.misc.extensionUtils.initTranslations();
}

function buildPrefsWidget() {
    const widget = new Me.imports.ddterm.pref.widget.PrefsWidget({
        settings: Me.imports.ddterm.settings.gui.get(),
    });

    return widget;
}

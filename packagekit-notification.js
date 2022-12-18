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

const System = imports.system;

const { GLib, GObject, Gio } = imports.gi;

const APP_DATA_DIR = Gio.File.new_for_commandline_arg(System.programInvocationName).get_parent();
imports.searchPath.unshift(APP_DATA_DIR.get_path());

const MODIFY_INTERFACE_XML = `
<node>
  <interface name="org.freedesktop.PackageKit.Modify">
    <method name="InstallPackageNames">
      <arg type="u" name="xid" direction="in"/>
      <arg type="as" name="packages" direction="in"/>
      <arg type="s" name="interaction" direction="in"/>
    </method>
  </interface>
</node>
`;

const NOTIFICATIONS_INTERFACE_XML = `
<node>
  <interface name="org.freedesktop.Notifications">
    <method name="Notify">
      <arg type="s" direction="in" name="app_name"/>
      <arg type="u" direction="in" name="replaces_id"/>
      <arg type="s" direction="in" name="app_icon"/>
      <arg type="s" direction="in" name="summary"/>
      <arg type="s" direction="in" name="body"/>
      <arg type="as" direction="in" name="actions"/>
      <arg type="a{sv}" direction="in" name="hints"/>
      <arg type="i" direction="in" name="expire_timeout"/>
      <arg type="u" direction="out" name="id"/>
    </method>
    <method name="CloseNotification">
      <arg type="u" direction="in" name="id"/>
    </method>
    <signal name="NotificationClosed">
      <arg type="u" name="id"/>
      <arg type="u" name="reason"/>
    </signal>
    <signal name="ActionInvoked">
      <arg type="u" name="id"/>
      <arg type="s" name="action_key"/>
    </signal>
  </interface>
</node>
`;

const ModifyProxy = Gio.DBusProxy.makeProxyWrapper(MODIFY_INTERFACE_XML);
const NotificationsProxy = Gio.DBusProxy.makeProxyWrapper(NOTIFICATIONS_INTERFACE_XML);

const Application = GObject.registerClass(
    class DDTermPackageKitApplication extends Gio.Application {
        _init(params) {
            super._init(params);

            this.add_main_option(
                'package',
                0,
                GLib.OptionFlags.NONE,
                GLib.OptionArg.STRING_ARRAY,
                'Request package to be installed',
                'PACKAGE_NAME'
            );

            this.add_main_option(
                'file',
                0,
                GLib.OptionFlags.NONE,
                GLib.OptionArg.STRING_ARRAY,
                'Request file to be installed',
                'FILENAME'
            );

            GLib.set_application_name('Drop Down Terminal');

            this.notification_id = 0;

            this.connect('startup', this.startup.bind(this));
            this.connect('shutdown', this.shutdown.bind(this));
            this.connect('command-line', this.command_line.bind(this));
            this.connect('activate', this.show.bind(this));
        }

        show() {
            this.close();

            if (this.packages.length === 0 && this.files.length === 0)
                return;

            const has_packagekit = this.modify_proxy.get_name_owner();

            const package_list = this.packages.map(v => `- ${v}`).join('\n');
            const message_packages_packagekit =
                'These additional packages need to be installed:';
            const message_packages_no_packagekit =
                'These additional packages need to be installed manually:';
            const message_packages =
                has_packagekit ? message_packages_packagekit : message_packages_no_packagekit;

            const unresolved_list = this.files.map(v => `- ${v}`).join('\n');
            const message_unresolved =
                'You will have to install packages that provide these files manually:';

            const message_lines = ['ddterm needs additional packages to run.'];

            if (this.packages.length > 0)
                message_lines.push(message_packages, package_list);

            if (this.files.length > 0)
                message_lines.push(message_unresolved, unresolved_list);

            const message_body = message_lines.join('\n');

            const actions = [];

            if (has_packagekit && this.packages.length > 0)
                actions.push('install', 'Install');

            printerr(message_body);

            [this.notification_id] = this.notifications_proxy.NotifySync(
                GLib.get_application_name(),
                0,
                '',
                'Install dependencies',
                message_body,
                actions,
                [],
                -1
            );

            if (this.notification_id)
                this.hold();
        }

        install() {
            if (this.packages.length > 0)
                this.modify_proxy.InstallPackageNamesSync(0, this.packages, 'default');
        }

        startup() {
            this.notifications_proxy = NotificationsProxy(
                this.get_dbus_connection(),
                'org.freedesktop.Notifications',
                '/org/freedesktop/Notifications'
            );

            this.notifications_proxy.connectSignal(
                'NotificationClosed',
                (proxy, owner, args) => {
                    const [notification_id] = args;
                    this.notification_closed(notification_id);
                }
            );

            this.notifications_proxy.connectSignal(
                'ActionInvoked',
                () => {
                    this.install();
                }
            );

            this.modify_proxy = ModifyProxy(
                this.get_dbus_connection(),
                'org.freedesktop.PackageKit',
                '/org/freedesktop/PackageKit'
            );
        }

        notification_closed(notification_id) {
            if (this.notification_id !== notification_id)
                return;

            this.notification_id = 0;
            this.release();
        }

        close() {
            const notification_id = this.notification_id;

            if (!notification_id)
                return;

            this.notification_closed(notification_id);
            this.notifications_proxy.CloseNotificationSync(notification_id);
        }

        shutdown() {
            this.close();
        }

        command_line(_, command_line) {
            const options = command_line.get_options_dict();

            function get_array_option(key) {
                const variant_value =
                    options.lookup_value(key, GLib.VariantType.new('as'));

                const unpacked = variant_value ? variant_value.deepUnpack() : [];

                return Array.from(new Set(unpacked)).sort();
            }

            this.packages = get_array_option('package');
            this.files = get_array_option('file');
            this.show();
        }
    }
);

const app = new Application({
    application_id: 'com.github.amezin.ddterm.packagekit',
    flags: Gio.ApplicationFlags.HANDLES_COMMAND_LINE,
});

System.exit(app.run([System.programInvocationName].concat(ARGV)));

import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import Meta from 'gi://Meta';
import Gio from 'gi://Gio';

async function getPowerProfile() {
    const proxy = await Gio.DBusProxy.new_for_bus(
        Gio.BusType.SYSTEM,
        Gio.DBusProxyFlags.NONE,
        null,
        'net.hadess.PowerProfiles',
        '/net/hadess/PowerProfiles',
        'org.freedesktop.DBus.Properties',
        null
    );

    const result = await proxy.call(
        'Get',
        new GLib.Variant(
            '(ss)',
            ['net.hadess.PowerProfiles', 'ActiveProfile']
        ),
        Gio.DBusCallFlags.NONE,
        -1,
        null
    );

    return result.deepUnpack()[0].deepUnpack();
}

async function setPowerProfile(profile) {
    const proxy = await Gio.DBusProxy.new_for_bus(
        Gio.BusType.SYSTEM,
        Gio.DBusProxyFlags.NONE,
        null,
        'net.hadess.PowerProfiles',
        '/net/hadess/PowerProfiles',
        'org.freedesktop.DBus.Properties',
        null
    );

    await proxy.call(
        'Set',
        new GLib.Variant(
            '(ssv)',
            [
                'net.hadess.PowerProfiles',
                'ActiveProfile',
                new GLib.Variant('s', profile),
            ]
        ),
        Gio.DBusCallFlags.NONE,
        -1,
        null
    );
}

export default class BlackScreenExtension {
  
	async enable() {
    	this._idleMonitor = global.backend.get_core_idle_monitor();
    	this._idleWatch = 0;
    	this._activeWatch = 0;
		this._actors = []
    	this._installIdleWatch();
    	this._previousProfile = getPowerProfile();
  	}
  
  	disable() {      
    	if (this._idleWatch) {
      		this._idleMonitor.remove_watch(this._idleWatch);
      		this._idleWatch = 0;
    	}

    	if (this._activeWatch) {
      		this._idleMonitor.remove_watch(this._activeWatch);
      		this._activeWatch = 0;
    	}

    	this._hideScreen();
  	}

  	_installIdleWatch() {      
    	this._idleWatch = this._idleMonitor.add_idle_watch(1000 * 60 * 10, () => {
      		this._showScreen();
    	});      
  	}
	
	async _showScreen() {
		this._previousProfile = getPowerProfile();
		
		global.display.set_cursor(Meta.Cursor.NONE);

	  	const count = global.display.get_n_monitors();

	  	for (let i = 0; i < count; i++) {

	    	const m = global.display.get_monitor_geometry(i);
      
      		const actor = new St.Widget({
	      		style: 'background-color: #000000;'
	    	});

	    	actor.reactive = true;
	    	actor.set_position(m.x, m.y);
	    	actor.set_size(m.width, m.height);

	    	Main.layoutManager.addTopChrome(actor);

			this._actors.push(actor);
		}

		this._activeWatch = this._idleMonitor.add_user_active_watch(() => {
      		this._hideScreen();
      		this._activeWatch = 0;
      		this._installIdleWatch();
    	});
        
    	await setPowerProfile('power-saver');       
  	}

  	async _hideScreen() {
    	for (const actor of this._actors) actor.destroy();

	  	this._actors = [];

	  	global.display.set_cursor(Meta.Cursor.DEFAULT);
	    
	  	await setPowerProfile(this._previousProfile);     
  	}
}

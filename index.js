require("./devices/ir-remote-learn");
require("./devices/ir-remote-switch");
require("./devices/ir-remote-custom-switch");
require("./devices/ir-remote-light");
require("./devices/ir-remote-projector");
require("./devices/ir-remote-momentary-switch");
require("./devices/ir-remote-air-conditioner");
require("./devices/lg-whisen-air-conditioner");

const miio = require('miio');
var homebridgeAPI;

module.exports = function (homebridge) {
    if (!checkPlatformConfig(homebridge, "MiRemote")) return;
    homebridgeAPI = homebridge
    homebridge.registerPlatform('homebridge-mi-remote', 'MiRemote', MiRemotePlatform, true);
}


function checkPlatformConfig(homebridge, platform) {
    const { platforms } = require(`${homebridge.user.configPath()}`);
    return Object.values(platforms).some(({ platform: currentPlatform }) => currentPlatform === platform);
}

function MiRemotePlatform(log, config, api) {
    if (null == config) {
        return;
    }

    this.HomebridgeAPI = homebridgeAPI;

    this.log = log;
    this.config = config;
    this.api = api;
    this.api.on('didFinishLaunching', () => {
        //this.log.info("Done!");
    });

    //this.log.info("Loading v%s ",require("./package.json").version);

}

MiRemotePlatform.prototype.accessories = function (callback) {
    var LoadedAccessories = [];
    if (this.config['hidelearn'] == false) {
        LoadedAccessories.push(new MiRemoteLearn(this, this.config['learnconfig']));
    }
    var deviceCfgs = this.config['deviceCfgs'];

    if (deviceCfgs instanceof Array) {
        for (var i = 0; i < deviceCfgs.length; i++) {
            var deviceCfg = deviceCfgs[i];
            if (deviceCfg.type == null || deviceCfg.type == "") continue;

            switch (deviceCfg.type) {
                case "Switch":
                    LoadedAccessories.push(new MiRemoteSwitch(this, deviceCfg));
                    break;
                case "Light":
                    LoadedAccessories.push(new MiRemoteLight(this, deviceCfg));
                    break;
                case "Projector":
                    LoadedAccessories.push(new MiRemoteProjector(this, deviceCfg));
                    break;
                case "AirConditioner":
                    LoadedAccessories.push(new MiRemoteAirConditioner(this, deviceCfg));
                    break;
                case "Custom":
                    LoadedAccessories.push(new MiRemoteCustom(this, deviceCfg));
                    break;
                case "MomentarySwitch":
                    LoadedAccessories.push(new MiRemoteMomentarySwitch(this, deviceCfg));
                    break;
                case "Thermostat":
                    LoadedAccessories.push(new MiRemoteThermostat(this, deviceCfg));
                    break;
                default:
                    this.log.error("device type:", deviceCfg.type, "unsupported.");
                    break;
            }

        }
        this.log.info("Loaded accessories: " + LoadedAccessories.length);
    }

    callback(LoadedAccessories);
}

MiRemotePlatform.prototype.getMiioDevice = function (configarray, dthat) {
    let device;
    try {
        device = new miio.device(configarray)
            .then(function (device) {
                dthat.readydevice = true;
                dthat.device = device;
                //that.log.debug("Linked To " + configarray.address);
            })
            .catch(err => console.log('Error occurred:', err));
        //this.log.debug("Lowercase Success！");
    } catch (e) {
        //this.log.debug("Lowercase failed");
    }
}

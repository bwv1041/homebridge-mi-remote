require("./devices/ir-remote-learn");
require("./devices/ir-remote-switch");
require("./devices/ir-remote-custom-switch");
require("./devices/ir-remote-light");
require("./devices/ir-remote-projector");
require("./devices/ir-remote-momentary-switch");
require("./devices/ir-remote-air-conditioner");
require("./devices/lg-air-conditioner");

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
    if (!this.config.ip) {
        if (!this.config.host) throw new Error('You must provide host IP address of the device.');
        else this.config.ip = this.config.host;
    }
    if (!this.config.token) {
        throw new Error('You must provide token of the device.');
    }

    this.api = api;
    this.api.on('didFinishLaunching', () => {
        //this.log.info("Done!");
    });

    //this.log.info("Loading v%s ",require("./package.json").version);

}

MiRemotePlatform.prototype.accessories = function (callback) {
    var LoadedAccessories = [];
    if (!this.config.hideLearn && !this.config.hidelearn) {
        LoadedAccessories.push(new MiRemoteLearn(this, {
                ip: this.config.ip,
                token: this.config.token
            }));
    }
    var deviceCfgs = this.config.deviceCfgs;

    if (deviceCfgs instanceof Array) {
        for (var i = 0; i < deviceCfgs.length; i++) {
            var deviceCfg = deviceCfgs[i];
            if (deviceCfg.type == null || deviceCfg.type == "") continue;
            if (deviceCfg.ip == null || deviceCfg.ip == "") deviceCfg.ip = this.config.ip;
            if (deviceCfg.token == null || deviceCfg.token == "") deviceCfg.token = this.config.token;

            switch (deviceCfg.type) {
                case "Switch":
                    if (deviceCfg.Name == null || deviceCfg.Name == "") deviceCfg.Name = deviceCfg.name || deviceCfg.type;
                    if (deviceCfg.data == null || deviceCfg.data == "") continue;
                    LoadedAccessories.push(new MiRemoteSwitch(this, deviceCfg));
                    break;
                case "Light":
                    if (deviceCfg.Name == null || deviceCfg.Name == "") deviceCfg.Name = deviceCfg.name || deviceCfg.type;
                    if (deviceCfg.data == null || deviceCfg.data == "") continue;
                    LoadedAccessories.push(new MiRemoteLight(this, deviceCfg));
                    break;
                case "Projector":
                    if (deviceCfg.Name == null || deviceCfg.Name == "") deviceCfg.Name = deviceCfg.name || deviceCfg.type;
                    if (deviceCfg.data == null || deviceCfg.data == "") continue;
                    if (deviceCfg.data.interval != null) deviceCfg.interval = deviceCfg.data.interval;
                    if (deviceCfg.interval == null || deviceCfg.interval == "") continue;
                    LoadedAccessories.push(new MiRemoteProjector(this, deviceCfg));
                    break;
                case "AirConditioner":
                    if (deviceCfg.Name == null || deviceCfg.Name == "") deviceCfg.Name = deviceCfg.name || deviceCfg.type;
                    if (deviceCfg.data == null || deviceCfg.data == "") continue;
                    if (deviceCfg.DefaultTemperature == null) if (deviceCfg.data.DefaultTemperature != null) deviceCfg.DefaultTemperature = deviceCfg.data.DefaultTemperature;
                    if (deviceCfg.MinTemperature == null) if (deviceCfg.data.MinTemperature != null) deviceCfg.MinTemperature = deviceCfg.data.MinTemperature;
                    if (deviceCfg.MaxTemperature == null) if (deviceCfg.data.MaxTemperature != null) deviceCfg.MaxTemperature = deviceCfg.data.MaxTemperature;
                    LoadedAccessories.push(new MiRemoteAirConditioner(this, deviceCfg));
                    break;
                case "Custom":
                    if (deviceCfg.Name == null || deviceCfg.Name == "") deviceCfg.Name = deviceCfg.name || deviceCfg.type;
                    if (deviceCfg.data == null || deviceCfg.data == "") continue;
                    LoadedAccessories.push(new MiRemoteCustom(this, deviceCfg));
                    break;
                case "MomentarySwitch":
                    if (deviceCfg.Name == null || deviceCfg.Name == "") deviceCfg.Name = deviceCfg.name || deviceCfg.type;
                    if (deviceCfg.data == null || deviceCfg.data == "") continue;
                    LoadedAccessories.push(new MiRemoteMomentarySwitch(this, deviceCfg));
                    break;
                case "LGAirConditioner":
                    LoadedAccessories.push(new LGAirConditioner(this, deviceCfg));
                    break;
                default:
                    this.log.error("Unsupported device type:", deviceCfg.type);
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

let Service, Characteristic;
const miio = require('miio');

MiRemoteThermostat = function (platform, config) {
    Service = platform.HomebridgeAPI.hap.Service;
    Characteristic = platform.HomebridgeAPI.hap.Characteristic;

    this.config = config;
    this.log = platform.log;

    this.ip = platform.config.learnconfig.ip || config.ip;
    this.token = platform.config.learnconfig.token || config.token;

    if (!this.ip) {
        throw new Error('Your must provide IP address of the IR remote device.');
    }

    if (!this.token) {
        throw new Error('Your must provide token of the IR remote device.');
    }

    this.name = config.name || config.type;
    this.data = config.data;

    this.make = config.info['Manufacturer'];
    this.serial = config.info['SerialNumber'] || config.token.substring(config.token.length - 8);
    this.model = config.info['Model'] || "chuangmi.ir.v2"
    this.firmware = config.info["Firmware"] || require("../package.json").version;
    this.hardware = config.info["Hardware"] || "miio: 88203200";

    this.deviceConnectPollInterval = 120000;
    this.deviceLock = false;
    this.connect();

    this.timeout = config["timeout"] || 120;
    this.deviceLockInterval = config["deviceLockInterval"] || 1000;
    this.setPriority = 2.0;
    this.numQueue = 0;

    this.fanSpeedCache = {
        "Heat": 4,
        "Cool": 4,
        "Auto": 4,
        "Fan": 4,
        "Dehumidify": 1,
        "AirPurify": 1
    }
    this.tempCache = {
        "Heat": 30,
        "Cool": 18,
        "Auto": 22
    }

    this.services = [];

    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, this.make)
        .setCharacteristic(Characteristic.Model, this.model)
        .setCharacteristic(Characteristic.SerialNumber, this.serial)
        .setCharacteristic(Characteristic.FirmwareRevision, this.firmware)
        .setCharacteristic(Characteristic.HardwareRevision, this.hardware);
    this.services.push(infoService);

    var thermostatService = new Service.Thermostat("Thermostat");
    this.targetHeatingCoolingStateCharacteristic = thermostatService.getCharacteristic(Characteristic.TargetHeatingCoolingState);
    this.targetHeatingCoolingStateCharacteristic
        .on('get', this.getTargetHeatingCoolingState.bind(this))
        .on('set', this.setTargetHeatingCoolingState.bind(this));

    this.currentHeatingCoolingStateCharacteristic = thermostatService.getCharacteristic(Characteristic.CurrentHeatingCoolingState);
    this.currentHeatingCoolingStateCharacteristic
        .on('get', this.getCurrentHeatingCoolingState.bind(this));

    this.targetTemperatureCharacteristic = thermostatService.getCharacteristic(Characteristic.TargetTemperature);
    this.targetTemperatureCharacteristic
        .setProps({
            maxValue: 30,
            minValue: 18,
            minStep: 1
        })
        .on('get', this.getTargetTemperature.bind(this))
        .on('set', this.setTargetTemperature.bind(this))
        .updateValue(24);

    this.targetHeatingTemperatureCharacteristic = thermostatService.addCharacteristic(Characteristic.HeatingThresholdTemperature)
        .setProps({
            maxValue: 30,
            minValue: 16,
            minStep: 1
        })
        .on('get', this.getTargetTemperature.bind(this))
        .on('set', this.setTargetTemperature.bind(this))
        .updateValue(30);
    this.targetCoolingTemperatureCharacteristic = thermostatService.addCharacteristic(Characteristic.CoolingThresholdTemperature)
        .setProps({
            maxValue: 30,
            minValue: 18,
            minStep: 1
        })
        .on('get', this.getTargetTemperature.bind(this))
        .on('set', this.setTargetTemperature.bind(this))
        .updateValue(18);

    this.currentTemperatureCharacteristic = thermostatService.getCharacteristic(Characteristic.CurrentTemperature)
    this.currentTemperatureCharacteristic
        .on('get', this.getCurrentTemperature.bind(this))
        .updateValue(24);

    this.temperatureDisplayUnits = thermostatService.getCharacteristic(Characteristic.TemperatureDisplayUnits)
    this.temperatureDisplayUnits
        .setProps({
            maxValue: 0,
            minValue: 0,
            validValues: [0],
        })
        .on('get', (callback) => callback(Characteristic.TemperatureDisplayUnits.CELSIUS));

    this.services.push(thermostatService);


    var fanService = new Service.Fanv2("FanSpeed");
    this.activeFanCharacteristic = fanService.getCharacteristic(Characteristic.Active);
    this.activeFanCharacteristic
        .on('get', this.getActiveFan.bind(this))
        .on('set', this.setActiveFan.bind(this));

    this.fanSpeedCharacteristic = fanService.addCharacteristic(Characteristic.RotationSpeed);
    this.fanSpeedCharacteristic
        .setProps({
            maxValue: 4,
            minValue: 0,
            validValues: [0, 1, 2, 3, 4]
        })
        .on('get', this.getFanSpeed.bind(this))
        .on('set', this.setFanSpeed.bind(this));

    this.fanOscillateCharacteristic = fanService.addCharacteristic(Characteristic.SwingMode);
    this.fanOscillateCharacteristic
        .setProps({
            validValues: [0, 1]
        })
        .on('get', this.getFanOscillate.bind(this))
        .on('set', this.setFanOscillate.bind(this));

    this.services.push(fanService);


    var dehumidifierService = new Service.HumidifierDehumidifier("Dehumidifier");
    this.activeDehumidifierCharacteristic = dehumidifierService.getCharacteristic(Characteristic.Active);
    this.activeDehumidifierCharacteristic
        .on('get', this.getActiveDehumidifier.bind(this))
        .on('set', this.setActiveDehumidifier.bind(this));

    this.targetDehumidifierStateCharacteristic = dehumidifierService.getCharacteristic(Characteristic.TargetHumidifierDehumidifierState);
    this.targetDehumidifierStateCharacteristic
        .setProps({
            validValues: [2]
        })
        .on('get', this.getTargetDehumidifierState.bind(this))
        .on('set', function (value, callback) {
            setTimeout(function () {
                callback(null);
            }.bind(this, value, callback), this.setPriority * 0.5)
        }.bind(this));

    this.currentDehumidifierStateCharacteristic = dehumidifierService.getCharacteristic(Characteristic.CurrentHumidifierDehumidifierState);
    this.currentDehumidifierStateCharacteristic
        .setProps({
            validValues: [0, 1, 3]
        })
        .on('get', this.getCurrentDehumidifierState.bind(this));

    this.targetRelativeHumidityCharacteristic = dehumidifierService.addCharacteristic(Characteristic.RelativeHumidityDehumidifierThreshold);
    this.targetRelativeHumidityCharacteristic
        .setProps({
            validValues: [0],
            notify: false
        })
        .on('get', this.getTargetRelativeHumidity.bind(this))
        .on('set', function (value, callback) {
            setTimeout(function () {
                if (value == this.targetRelativeHumidityCharacteristic.value) {
                    callback(null);
                } else {
                    if (value == 0) {
                        callback(null);
                    } else if (value != 0) {
                        setTimeout(function () {
                            this.targetRelativeHumidityCharacteristic.updateValue(0);
                        }.bind(this), 10);
                        callback(null);
                    }
                }
            }.bind(this, value, callback), this.setPriority * 1)

        }.bind(this));

    this.currentRelativeHumidityCharacteristic = dehumidifierService.getCharacteristic(Characteristic.CurrentRelativeHumidity);
    this.currentRelativeHumidityCharacteristic
        .setProps({
            notify: false
        })
        .on('get', this.getCurrentRelativeHumidity.bind(this));

    this.services.push(dehumidifierService);


    var airPurifierService = new Service.AirPurifier("AirPurifier");
    this.activeAirPurifierCharacteristic = airPurifierService.getCharacteristic(Characteristic.Active);
    this.activeAirPurifierCharacteristic
        .on('get', this.getActiveAirPurifier.bind(this))
        .on('set', this.setActiveAirPurifier.bind(this));

    this.targetAirPurifierStateCharacteristic = airPurifierService.getCharacteristic(Characteristic.TargetAirPurifierState);
    this.targetAirPurifierStateCharacteristic.updateValue(1);
    this.targetAirPurifierStateCharacteristic
        .setProps({
            validValues: [1]
        })
        .on('get', this.getTargetAirPurifierState.bind(this))
        .on('set', function (value, callback) {
            setTimeout(function () {
                var id = "targetAirPurifierState"
                var currentValue = function () {
                    return this.targetAirPurifierStateCharacteristic.value;
                }.bind(this); var updateValue = function (value) { this.targetAirPurifierStateCharacteristic.updateValue(value); }.bind(this);

                if (currentValue() == value) {
                } else {
                    if (value == 0) {
                        setTimeout(function () {
                            updateValue(1 - value);
                        }.bind(this, value), 100);
                    } else if (value == 1) {
                    }
                }

                callback(null);
            }.bind(this, value, callback), this.setPriority * 4)
        }.bind(this));

    this.currentAirPurifierStateCharacteristic = airPurifierService.getCharacteristic(Characteristic.CurrentAirPurifierState);
    this.currentAirPurifierStateCharacteristic
        .setProps({
            validValues: [0, 1, 2]
        })
        .on('get', this.getCurrentAirPurifierState.bind(this));

    this.services.push(airPurifierService);


    var rapidHeaterCoolerSwitchService = new Service.Switch("BoostPower", "RapidHeaterCooler");
    this.rapidHeaterCoolerCharacteristic = rapidHeaterCoolerSwitchService.getCharacteristic(Characteristic.On);
    this.rapidHeaterCoolerCharacteristic
        .on('get', this.getrapidHeaterCooler.bind(this))
        .on('set', this.setRapidHeaterCooler.bind(this));
    this.services.push(rapidHeaterCoolerSwitchService);


    var afterBlowSwitchService = new Service.Switch("AfterBlow", "AfterBlowSwitch");
    this.afterBlowSwitchOnCharacteristic = afterBlowSwitchService.getCharacteristic(Characteristic.On);
    this.afterBlowSwitchOnCharacteristic
        .on('get', this.getAfterBlowSwitch.bind(this))
        .on('set', this.setAfterBlowSwitch.bind(this));
    this.services.push(afterBlowSwitchService);


    var indicatorLightSwitchService = new Service.Switch("IndicatorLED", "IndicatorLightSwitch");
    this.indicatorLightSwitchOnCharacteristic = indicatorLightSwitchService.getCharacteristic(Characteristic.On);
    this.indicatorLightSwitchOnCharacteristic
        .on('get', this.getIndicatorLightSwitch.bind(this))
        .on('set', this.setIndicatorLightSwitch.bind(this));

    this.services.push(indicatorLightSwitchService);



};


MiRemoteThermostat.prototype = {

    getTargetHeatingCoolingState: function (callback) {
        callback(null, this.targetHeatingCoolingStateCharacteristic.value);
    },

    getCurrentHeatingCoolingState: function (callback) {
        callback(null, this.currentHeatingCoolingStateCharacteristic.value);
    },

    getTargetTemperature: function (callback) {
        callback(null, this.targetTemperatureCharacteristic.value);
    },

    getCurrentTemperature: function (callback) {
        callback(null, this.currentTemperatureCharacteristic.value);
    },

    getActiveDehumidifier: function (callback) {
        callback(null, this.activeDehumidifierCharacteristic.value);
    },

    getTargetDehumidifierState: function (callback) {
        callback(null, this.targetDehumidifierStateCharacteristic.value);
    },

    getCurrentDehumidifierState: function (callback) {
        callback(null, this.currentDehumidifierStateCharacteristic.value);
    },

    getTargetRelativeHumidity: function (callback) {
        callback(null, this.targetRelativeHumidityCharacteristic.value);
    },

    getCurrentRelativeHumidity: function (callback) {
        callback(null, this.currentRelativeHumidityCharacteristic.value);
    },

    getActiveFan: function (callback) {
        callback(null, this.activeFanCharacteristic.value);
    },

    getFanSpeed: function (callback) {
        callback(null, this.fanSpeedCharacteristic.value);
    },

    getFanOscillate: function (callback) {
        callback(null, this.fanOscillateCharacteristic.value);
    },

    getActiveAirPurifier: function (callback) {
        callback(null, this.activeAirPurifierCharacteristic.value);
    },

    getTargetAirPurifierState: function (callback) {
        callback(null, this.targetAirPurifierStateCharacteristic.value);
    },

    getCurrentAirPurifierState: function (callback) {
        callback(null, this.currentAirPurifierStateCharacteristic.value);
    },

    getrapidHeaterCooler: function (callback) {
        callback(null, this.rapidHeaterCoolerCharacteristic.value);
    },

    getAfterBlowSwitch: function (callback) {
        callback(null, this.afterBlowSwitchOnCharacteristic.value);
    },

    getIndicatorLightSwitch: function (callback) {
        callback(null, this.indicatorLightSwitchOnCharacteristic.value);
    },

    setTargetHeatingCoolingState: async function (value, callback) {
        await this.setPause(4);
        await this.addQueue(this.protocol('setTargetHeatingCoolingState'), value, callback);
    },

    setTargetTemperature: async function (value, callback) {
        await this.setPause(5);
        await this.addQueue(this.protocol('setTargetTemperature'), value, callback);
    },

    setActiveDehumidifier: async function (value, callback) {
        await this.setPause(0);
        await this.addQueue(this.protocol('setActiveDehumidifier'), value, callback);
    },

    setActiveFan: async function (value, callback) {
        await this.setPause(9);
        await this.addQueue(this.protocol('setActiveFan'), value, callback);
    },

    setFanSpeed: async function (value, callback) {
        await this.setPause(11);
        await this.addQueue(this.protocol('setFanSpeed'), value, callback);
    },

    setFanOscillate: async function (value, callback) {
        await this.setPause(13);
        await this.addQueue(this.protocol('setFanOscillate'), value, callback);
    },

    setActiveAirPurifier: async function (value, callback) {
        await this.setPause(7);
        await this.addQueue(this.protocol('setActiveAirPurifier'), value, callback);
    },

    setRapidHeaterCooler: async function (value, callback) {
        if (value == 0) {
            this.setActiveFan(0, callback);
        } else {
            if (this.getTargetHeatingCoolingState.value != 1)
                this.setTargetHeatingCoolingState(2, () => { });
            await this.setPause(6);
            await this.addQueue(this.protocol('setRapidHeaterCooler'), value, callback);
        }
    },

    setAfterBlowSwitch: async function (value, callback) {
        await this.setPause(14);
        await this.addQueue(this.protocol('setAfterBlowSwitch'), value, callback);
    },

    setIndicatorLightSwitch: async function (value, callback) {
        await this.setPause(18);
        await this.addQueue(this.protocol('setIndicatorLightSwitch'), value, callback);
    },


    protocol: function (id) {
        switch (id) {
            case 'setTargetHeatingCoolingState': return (value) => {
                var currentValue = function () { return this.targetHeatingCoolingStateCharacteristic.value }.bind(this);
                var updateValue = function (value) { this.targetHeatingCoolingStateCharacteristic.updateValue(value) }.bind(this);

                if (value == 0) {
                    var code = () => {
                        var fanMode = this.getActiveStatus();
                        var data = this.data[fanMode]["Off"];
                        this.log.debug("[Process] " + id + ": callDevice " + fanMode + " Off");
                        return data;
                    };
                    var res = (value) => {
                        this.targetHeatingCoolingStateCharacteristic.updateValue(value);
                        this.currentHeatingCoolingStateCharacteristic.updateValue(value % 3);
                        this.activeFanCharacteristic.updateValue(0);
                        this.fanSpeedCharacteristic.updateValue(0);
                        this.activeDehumidifierCharacteristic.updateValue(0);
                        this.currentDehumidifierStateCharacteristic.updateValue(0);
                        this.activeAirPurifierCharacteristic.updateValue(0);
                        this.currentAirPurifierStateCharacteristic.updateValue(0);
                        if (typeof this.rapidHeaterCoolerQueue == 'object') clearTimeout(this.rapidHeaterCoolerQueue);
                        this.rapidHeaterCoolerCharacteristic.updateValue(false);
                        this.indicatorLightSwitchOnCharacteristic.updateValue(false);
                    };
                } else {
                    var code = () => {
                        var fanMode = formatTargetHeatingCoolingState(value);
                        if (this.isPowerOn()) {
                            this.log.debug("[Process] " + id + ": callDevice Switch to " + fanMode);
                            var data = this.data["Mode"][fanMode];
                        } else {
                            this.log.debug("[Process] " + id + ": callDevice " + fanMode + " On");
                            var data = this.data[fanMode]["On"];
                        }
                        return data;
                    };

                    var res = (value) => {
                        this.targetHeatingCoolingStateCharacteristic.updateValue(value);
                        this.currentHeatingCoolingStateCharacteristic.updateValue(value % 3);
                        this.activeFanCharacteristic.updateValue(1);
                        this.activeDehumidifierCharacteristic.updateValue(0);
                        this.currentDehumidifierStateCharacteristic.updateValue(0);
                        if (this.currentAirPurifierStateCharacteristic.value == 1) this.currentAirPurifierStateCharacteristic.updateValue(2);
                        if (this.currentHeatingCoolingStateCharacteristic.value == 0) {
                            if (typeof this.rapidHeaterCoolerQueue == 'object') clearTimeout(this.rapidHeaterCoolerQueue);
                            this.rapidHeaterCoolerCharacteristic.updateValue(false);
                        }
                        this.indicatorLightSwitchOnCharacteristic.updateValue(true);

                        this.currentTemperatureCharacteristic.updateValue(this.tempCache[this.getActiveStatus()]);
                        this.targetTemperatureCharacteristic.updateValue(this.tempCache[this.getActiveStatus()]);
                        this.fanSpeedCharacteristic.updateValue(this.fanSpeedCache[this.getActiveStatus()]);
                    };
                }
                return { "id": id, "currentValue": currentValue, "updateValue": updateValue, "code": code, "res": res };
            };

            case 'setTargetTemperature': return (value) => {
                var currentValue = function () { return this.targetTemperatureCharacteristic.value; }.bind(this);
                var updateValue = function (value) { this.targetTemperatureCharacteristic.updateValue(value); }.bind(this);
                if (value == 0) {
                    var code = undefined;
                    var res = undefined;
                } else {
                    if (this.targetHeatingCoolingStateCharacteristic.value == 0) {
                        var code = undefined;
                        var res = (value) => {
                            this.targetTemperatureCharacteristic.updateValue(value);
                            this.currentTemperatureCharacteristic.updateValue(value);
                            return 0;
                        };

                    } else {
                        var code = () => {
                            var fanMode = this.getActiveStatus();
                            var data = this.data[fanMode][value];
                            return data;
                        };

                        var res = (value) => {
                            this.targetTemperatureCharacteristic.updateValue(value);
                            this.currentTemperatureCharacteristic.updateValue(value);
                            if (typeof this.rapidHeaterCoolerQueue == 'object') clearTimeout(this.rapidHeaterCoolerQueue);
                            this.rapidHeaterCoolerCharacteristic.updateValue(false);
                            this.indicatorLightSwitchOnCharacteristic.updateValue(true);
                            this.tempCache[this.getActiveStatus()] = value;
                        };
                    }
                }
                return { "id": id, "currentValue": currentValue, "updateValue": updateValue, "code": code, "res": res };
            };

            case 'setActiveDehumidifier': return (value) => {
                var currentValue = function () { return this.activeDehumidifierCharacteristic.value; }.bind(this);
                var updateValue = function (value) { this.activeDehumidifierCharacteristic.updateValue(value); }.bind(this);

                if (value == 0) {
                    var code = () => {
                        var data = this.data["Dehumidify"]["Off"];
                        return (data);
                    };

                    var res = (value) => {
                        this.activeDehumidifierCharacteristic.updateValue(value);
                        this.currentDehumidifierStateCharacteristic.updateValue(0);
                        this.targetHeatingCoolingStateCharacteristic.updateValue(0);
                        this.currentHeatingCoolingStateCharacteristic.updateValue(0);

                        this.activeFanCharacteristic.updateValue(0);
                        this.fanSpeedCharacteristic.updateValue(0);

                        this.activeAirPurifierCharacteristic.updateValue(0);
                        this.currentAirPurifierStateCharacteristic.updateValue(0);

                        if (typeof this.rapidHeaterCoolerQueue == 'object') clearTimeout(this.rapidHeaterCoolerQueue);
                        this.rapidHeaterCoolerCharacteristic.updateValue(false);
                        this.indicatorLightSwitchOnCharacteristic.updateValue(false);
                    };


                } else if (value == 1) {
                    var code = () => {
                        var fanMode = "Dehumidify";
                        if (this.isPowerOn()) {
                            this.log.debug("[Process] " + id + ": callDevice Switch to " + fanMode);
                            var data = this.data["Mode"][fanMode];
                        } else {
                            this.log.debug("[Process] " + id + ": callDevice " + fanMode + " On");
                            var data = this.data[fanMode]["On"];
                        }
                        return (data);
                    };

                    var res = (value) => {
                        this.activeDehumidifierCharacteristic.updateValue(1);
                        this.currentDehumidifierStateCharacteristic.updateValue(3);
                        this.targetDehumidifierStateCharacteristic.updateValue(2)
                        this.targetHeatingCoolingStateCharacteristic.updateValue(0);
                        this.currentHeatingCoolingStateCharacteristic.updateValue(2);
                        this.activeFanCharacteristic.updateValue(1);
                        if (this.currentAirPurifierStateCharacteristic.value == 1) this.currentAirPurifierStateCharacteristic.updateValue(2);
                        if (typeof this.rapidHeaterCoolerQueue == 'object') clearTimeout(this.rapidHeaterCoolerQueue);
                        this.rapidHeaterCoolerCharacteristic.updateValue(false);
                        this.indicatorLightSwitchOnCharacteristic.updateValue(true);

                        this.targetTemperatureCharacteristic.updateValue(0);
                        this.fanSpeedCharacteristic.updateValue(this.fanSpeedCache[this.getActiveStatus()]);
                    };
                }
                return { "id": id, "currentValue": currentValue, "updateValue": updateValue, "code": code, "res": res };
            };

            case 'setActiveFan': return (value) => {
                var currentValue = function () { return this.activeFanCharacteristic.value; }.bind(this);
                var updateValue = function (value) { this.activeFanCharacteristic.updateValue(value); }.bind(this);
                if (value == 0) {
                    var code = () => {
                        var fanMode = this.getActiveStatus();
                        var data = this.data[fanMode]["Off"];
                        if (typeof data == 'undefined') {
                            var fanMode = 'Auto';
                            var data = this.data[fanMode]["Off"];
                        }

                        this.log.debug("[Process] " + fanMode + " Off");
                        return data;
                    };

                    var res = (value) => {
                        this.activeFanCharacteristic.updateValue(value);
                        this.targetHeatingCoolingStateCharacteristic.updateValue(0);
                        this.currentHeatingCoolingStateCharacteristic.updateValue(0);
                        this.activeDehumidifierCharacteristic.updateValue(0);
                        this.currentDehumidifierStateCharacteristic.updateValue(0);
                        this.activeAirPurifierCharacteristic.updateValue(0);
                        this.currentAirPurifierStateCharacteristic.updateValue(0);
                        if (typeof this.rapidHeaterCoolerQueue == 'object') clearTimeout(this.rapidHeaterCoolerQueue);
                        this.rapidHeaterCoolerCharacteristic.updateValue(false);
                        this.indicatorLightSwitchOnCharacteristic.updateValue(false);
                    };

                } else if (value == 1) {
                    if (this.isPowerOn()) {
                        var code = undefined;
                        var res = undefined;
                    } else {
                        var code = () => {
                            this.log.debug("[Process] " + id + ": callDevice Fan On");
                            var data = this.data["Fan"]["On"];
                            return data;
                        };

                        var res = (value) => {
                            this.activeFanCharacteristic.updateValue(value);
                            this.indicatorLightSwitchOnCharacteristic.updateValue(true);

                            this.setPause(2);
                            this.fanSpeedCharacteristic.updateValue(this.fanSpeedCache[this.getActiveStatus()]);
                        };
                    }
                }
                return { "id": id, "currentValue": currentValue, "updateValue": updateValue, "code": code, "res": res };
            };

            case 'setFanSpeed': return (value) => {
                var currentValue = function () { return this.fanSpeedCharacteristic.value; }.bind(this);
                var updateValue = function (value) { this.fanSpeedCharacteristic.updateValue(value); }.bind(this);

                if (value == 0) {
                    var code = undefined;
                    var res = undefined;

                } else if (value != 0) {
                    if (this.activeFanCharacteristic.value == 0) {
                        var code = undefined;
                        var res = undefined;
                    } else if (this.activeFanCharacteristic.value == 1) {
                        var code = () => {

                            if (value < 2) {
                                var fanSpeed = "FanSpeed" + value;
                            } else if (value == 2) {
                                var fanSpeed = "FanSpeedAuto";
                            } else if (value > 2) {
                                var fanSpeed = value - 1;
                                fanSpeed = "FanSpeed" + fanSpeed;
                            }

                            var fanMode = this.getActiveStatus();
                            var data = this.data[fanMode][fanSpeed];
                            if (typeof data == 'undefined') {
                                var fanMode = 'FanSpeed';
                                var data = this.data[fanMode][fanSpeed];
                            }

                            this.log.debug("[Process] " + id + ": switch to " + fanMode, fanSpeed);
                            return data;

                        };

                        var res = (value) => {
                            this.fanSpeedCache[this.getActiveStatus()] = value;
                            this.fanSpeedCharacteristic.updateValue(value);
                            if (typeof this.rapidHeaterCoolerQueue == 'object') clearTimeout(this.rapidHeaterCoolerQueue);
                            this.rapidHeaterCoolerCharacteristic.updateValue(false);
                            this.indicatorLightSwitchOnCharacteristic.updateValue(true);
                        };
                    }
                }

                return { "id": id, "currentValue": currentValue, "updateValue": updateValue, "code": code, "res": res };
            };

            case 'setFanOscillate': return (value) => {
                var currentValue = function () { return this.fanOscillateCharacteristic.value; }.bind(this);
                var updateValue = function (value) { this.fanOscillateCharacteristic.updateValue(value); }.bind(this);


                if (this.activeFanCharacteristic.value == 0) {
                    var code = () => { return undefined };
                    var res = undefined;

                } else if (this.activeFanCharacteristic.value == 1) {
                    var code = () => {
                        if (value == 0) var data = this.data["Oscillate"]["Off"]
                        else var data = this.data["Oscillate"]["On"];
                        return data;
                    };

                    var res = () => {
                        this.fanOscillateCharacteristic.updateValue(value);
                        this.indicatorLightSwitchOnCharacteristic.updateValue(false);
                    };

                }

                return { "id": id, "currentValue": currentValue, "updateValue": updateValue, "code": code, "res": res };
            };

            case 'setActiveAirPurifier': return (value) => {
                var currentValue = function () { return this.activeAirPurifierCharacteristic.value; }.bind(this);
                var updateValue = function (value) { this.activeAirPurifierCharacteristic.updateValue(value); }.bind(this);

                if (value == 0) {
                    if (this.currentAirPurifierStateCharacteristic.value == 1) {
                        var code = () => {
                            var data = this.data["AirPurify"]["Off"];
                            return data;
                        };
                        var res = (value) => {
                            this.activeAirPurifierCharacteristic.updateValue(value);
                            this.currentAirPurifierStateCharacteristic.updateValue(0);
                            this.targetAirPurifierStateCharacteristic.updateValue(1);
                            this.activeFanCharacteristic.updateValue(0);
                            this.fanSpeedCharacteristic.updateValue(0);
                            this.indicatorLightSwitchOnCharacteristic.updateValue(false);
                        };
                    } else {
                        var code = () => {
                            var data = this.data["AirPurify"]["Off_fanSpeed3_activeFan"];
                            return data;
                        };
                        var res = (value) => {
                            this.activeAirPurifierCharacteristic.updateValue(value);
                            this.currentAirPurifierStateCharacteristic.updateValue(0);
                            this.targetAirPurifierStateCharacteristic.updateValue(1);
                        };
                    }
                } else if (value == 1) {
                    if (this.isPowerOn()) {
                        var code = () => {
                            var data = this.data["AirPurify"]["On_fanSpeed3_activeFan"];
                            return data;
                        };
                        var res = (value) => {
                            this.activeAirPurifierCharacteristic.updateValue(value);
                            this.currentAirPurifierStateCharacteristic.updateValue(2);
                            this.targetAirPurifierStateCharacteristic.updateValue(1);
                            this.indicatorLightSwitchOnCharacteristic.updateValue(true);
                        };
                    } else {
                        var code = () => {
                            var data = this.data["AirPurify"]["On"];
                            return data;
                        };
                        var res = (value) => {
                            this.activeAirPurifierCharacteristic.updateValue(value);
                            this.currentAirPurifierStateCharacteristic.updateValue(1);
                            this.targetAirPurifierStateCharacteristic.updateValue(1);
                            this.activeFanCharacteristic.updateValue(1);
                            this.fanSpeedCharacteristic.updateValue(1);
                            this.indicatorLightSwitchOnCharacteristic.updateValue(true);
                        };
                    }
                }
                return { "id": id, "currentValue": currentValue, "updateValue": updateValue, "code": code, "res": res };
            };

            case 'setRapidHeaterCooler': return (value) => {
                var currentValue = function () { return this.rapidHeaterCoolerCharacteristic.value; }.bind(this);
                var updateValue = function (value) { this.rapidHeaterCoolerCharacteristic.updateValue(value); }.bind(this);

                if (value == 0) {
                    var code = () => {
                        var data = this.data["Cool"]["Full"];
                        return data;
                    };
                    var res = (value) => {
                        if (typeof this.rapidHeaterCoolerQueue == 'object') clearTimeout(this.rapidHeaterCoolerQueue);
                        this.rapidHeaterCoolerCharacteristic.updateValue(false)
                        this.indicatorLightSwitchOnCharacteristic.updateValue(true);
                    };
                } else {
                    var code = () => {
                        var data = this.data["Cool"]["Full"];
                        return data;
                    };
                    var res = (value) => {
                        if (typeof this.rapidHeaterCoolerQueue == 'object') clearTimeout(this.rapidHeaterCoolerQueue);
                        this.rapidHeaterCoolerCharacteristic.updateValue(true)
                        this.indicatorLightSwitchOnCharacteristic.updateValue(true);

                        if (this.currentHeatingCoolingStateCharacteristic.value == 1) {
                            this.fanSpeedCache['Heat'] = this.fanSpeedCharacteristic.props.maxValue;
                            this.tempCache['Heat'] = this.targetTemperatureCharacteristic.props.maxValue;
                            this.targetTemperatureCharacteristic.updateValue(this.targetTemperatureCharacteristic.props.maxValue);
                        } else if (this.currentHeatingCoolingStateCharacteristic.value == 2) {
                            this.fanSpeedCache['Cool'] = this.fanSpeedCharacteristic.props.maxValue;
                            this.tempCache['Cool'] = this.targetTemperatureCharacteristic.props.minValue;
                            this.targetTemperatureCharacteristic.updateValue(0);
                        }
                        this.fanSpeedCharacteristic.updateValue(this.fanSpeedCharacteristic.props.maxValue);

                        this.rapidHeaterCoolerQueue = setTimeout(() => {
                            this.rapidHeaterCoolerCharacteristic.updateValue(false)
                        }, 1800000);
                    };
                }
                return { "id": id, "currentValue": currentValue, "updateValue": updateValue, "code": code, "res": res };
            };

            case 'setAfterBlowSwitch': return (value) => {
                var currentValue = function () { return this.afterBlowSwitchOnCharacteristic.value; }.bind(this);
                var updateValue = function (value) { this.afterBlowSwitchOnCharacteristic.updateValue(value); }.bind(this);

                if (value == 0) {
                    var code = function () {
                        var data = this.data["AfterBlow"]["Off"];
                        return data;
                    }.bind(this);
                    var res = function () {
                        this.afterBlowSwitchOnCharacteristic.updateValue(0);
                    }.bind(this);
                } else {
                    var code = function () {
                        var data = this.data["AfterBlow"]["On"];
                        return data;
                    }.bind(this);
                    var res = function () {
                        this.afterBlowSwitchOnCharacteristic.updateValue(1);
                        if (this.isPowerOn())
                            this.indicatorLightSwitchOnCharacteristic.updateValue(1);
                    }.bind(this);
                }
                return { "id": id, "currentValue": currentValue, "updateValue": updateValue, "code": code, "res": res };
            };

            case 'setIndicatorLightSwitch': return (value) => {
                var currentValue = function () { return this.indicatorLightSwitchOnCharacteristic.value; }.bind(this);
                var updateValue = function (value) { this.indicatorLightSwitchOnCharacteristic.updateValue(value); }.bind(this);

                if (this.isPowerOn()) {
                    var code = () => {
                        var data = this.data["IndicatorLightOff"]["Off"];
                        return data;
                    };
                    var res = (value) => {
                        this.indicatorLightSwitchOnCharacteristic.updateValue(value);
                    };
                } else {
                    var code = () => { return undefined };
                    var res = undefined;
                }

                return { "id": id, "currentValue": currentValue, "updateValue": updateValue, "code": code, "res": res };
            };

        }
    },


    discover: function (argv) {
        const log = require('miio/cli/log');
        const deviceFinder = require('miio/cli/device-finder');
        const tokens = require('miio/lib/tokens');
        const DeviceManagement = require('miio/lib/management');
        const chalk = require('miio/node_modules/chalk');

        if (this.ip != null) var options = { filter: this.ip };
        else var options = { cacheTime: 5 };

        const browser = deviceFinder(options);
        browser.on('available', device => {
            device.management = new DeviceManagement(device);
            const mgmt = device.management;
            const types = Array.from(device.metadata.types);
            const filteredTypes = types.filter(t => t.indexOf('miio:') === 0);
            const caps = Array.from(device.metadata.capabilities);

            console.log(chalk.bold('Device ID:'), device.id.replace(/^miio:/, ''));
            console.log(chalk.bold('Model info:'), mgmt.model || 'Unknown');

            if (mgmt.address) {
                console.log(chalk.bold('Address:'), mgmt.address);
            } else if (mgmt.parent) {
                console.log(chalk.bold('Address:'), 'Owned by', mgmt.parent.id);
            }

            if (mgmt.token) {
                console.log(chalk.bold('Token:'), mgmt.token, mgmt.autoToken ? chalk.green('via auto-token') : chalk.yellow('via stored token'));
            } else if (!mgmt.parent) {
                console.log(chalk.bold('Token:'), '???');
            } else {
                console.log(chalk.bold('Token:'), chalk.green('Automatic via parent device'));
            }

            console.log(chalk.bold('Support:'), mgmt.model ? (filteredTypes.length > 0 ? chalk.green('At least basic') : chalk.yellow('At least generic')) : chalk.yellow('Unknown'));

            if (detailed) {
                console.log();
                console.log(chalk.bold('Type info:'), types.join(', '));
                console.log(chalk.bold('Capabilities:'), caps.join(', '));
            }
            console.log();

        });
    },

    connect: async function () {
        try {
            var device = await new miio.device({
                address: this.ip,
                token: this.token
            });
            if (device.matches('type:miio')) {
                this.device = device;
                this.deviceConnect = true;
                this.lastConnectTime = new Date().getTime();
                return 0;
            } else {
                console.log('Device discovered at %s is not IR Remote Controller.', this.ip);
                return 0;
            }
        }
        catch (err) {
            this.deviceConnect = false;
            console.log(err);
            console.log('Will retry after 30 seconds...');
            setTimeout(() => {
                this.connect();
            }, 30000);
        }
    },

    addQueue: async function (protocol, value, callback) {
        var id = protocol(value).id;
        var currentValue = protocol(value).currentValue;
        var updateValue = protocol(value).updateValue;

        var lastValue = currentValue();
        var log = id + ": " + lastValue;
        this.log.debug("[Command] " + log + ">" + value);

        if (!this.deviceLock) {
            var result = await this.runQueue(protocol, value, log);
        } else {
            this.numQueue = this.numQueue + 1;
            var queue = this.numQueue
            var pauseTime = (this.deviceLockInterval * queue) / 1000;
            this.log.debug("[Queue#" + queue + "] " + log + ">" + value + ", wait for " + pauseTime + "sec");

            await this.setPause(this.deviceLockInterval * queue + 50);
            var currentValue = protocol(value).currentValue;
            if (lastValue != currentValue()) log = log + ">(" + currentValue() + ")";
            if (!this.deviceLock) {
                this.log.debug("[Queue#" + queue + "] " + log + ">" + value);
                var result = await this.runQueue(protocol, value, log);
            } else {
                this.log.error("[Error] device still busy after waiting");
                var result = -1;
            }
            this.numQueue = this.numQueue - 1;
        }

        if (result < 0) {
            this.log.info("[Rejected] " + log + ">(" + value + ")>" + lastValue);
            setTimeout(() => updateValue(lastValue), 10);
        } else if (result > 0) {
            this.log.info("[Resolved] " + log + ">" + value);
        } else {
            this.log.info("[Resolved] " + log + ">" + value);
        }
        callback(0);
    },

    runQueue: async function (protocol, value, log) {
        var id = protocol(value).id;
        var currentValue = protocol(value).currentValue;
        var code = protocol(value).code;
        var res = protocol(value).res;

        try {
            var data = code();
        }
        catch {
            var data = undefined;
        }

        if (currentValue() == value) {
            this.log.error("[Ignored] " + log + ">" + value);
            return (1);
        } else if (typeof code == 'undefined') {
            if (typeof res == 'undefined') {
                return (-1);
            } else {
                res(value);
                return (0);
            }
        } else if (typeof data == 'undefined') {
            this.log.error("[Error] " + id + ": invalid code");
            return (-1);
        } else {
            this.deviceLock = true;

            if (typeof runtime == 'undefined')
                var runtime = new Date().getTime();

            var sleepTime = new Date().getTime() - this.lastConnectTime;
            this.log.debug('[Process] last device connection:', (sleepTime - sleepTime % 1000) / 1000, 's (' + sleepTime, 'ms) ago');

            if (new Date().getTime() - this.lastConnectTime > this.deviceConnectPollInterval) {
                this.setPause(50);
                await this.device.destroy();
                this.log.debug('[Process] device destroy (runtime:', new Date().getTime() - runtime, 'ms)');
                await this.connect();
                this.log.debug('[Process] device reconnect: \\\\' + this.ip + '\\' + this.device.miioModel, '(runtime: ', new Date().getTime() - runtime, 'ms)');
            }

            this.log.debug('[Process] device call (runtime:', new Date().getTime() - runtime, 'ms)');
            var result = await this.device.call('miIO.ir_play', { 'freq': 38400, 'code': data });
            this.log.debug('[Process] device respond (runtime:', new Date().getTime() - runtime, 'ms)');
            this.lastConnectTime = new Date().getTime();

            if (result != 0) {
                this.log.error("[Exception] revice result: " + result);
            }

            this.deviceLock = false;
            res(value);
            return (result);
        }
    },

    getActiveStatus: function () {
        switch (this.targetHeatingCoolingStateCharacteristic.value) {
            case Characteristic.TargetHeatingCoolingState.OFF:
                switch (this.activeDehumidifierCharacteristic.value) {
                    case Characteristic.Active.INACTIVE:
                        switch (this.activeFanCharacteristic.value) {
                            case Characteristic.Active.INACTIVE:
                                return 'Off';
                            case Characteristic.Active.ACTIVE:
                                switch (this.activeAirPurifierCharacteristic.value) {
                                    case Characteristic.Active.INACTIVE:
                                        return 'Fan';
                                    case Characteristic.Active.ACTIVE:
                                        return 'AirPurify';
                                }
                        }
                    case Characteristic.Active.ACTIVE:
                        return 'Dehumidify';
                }
            case Characteristic.TargetHeatingCoolingState.COOL:
                return 'Cool';
            case Characteristic.TargetHeatingCoolingState.HEAT:
                return 'Heat';
            case Characteristic.TargetHeatingCoolingState.AUTO:
                return 'Auto';
            default:
                return 'Off';
        }
    },


    isPowerOn: function () {
        if (this.targetHeatingCoolingStateCharacteristic.value + this.activeFanCharacteristic.value + this.activeDehumidifierCharacteristic.value + this.activeAirPurifierCharacteristic.value != 0)
            return true
        else
            return false
    },

    setPause: async function (ms) {
        return new Promise(resolve => {
            setTimeout(resolve, ms);
        });
    },

    identify: function (callback) {
        callback();
    },

    getServices: function () {
        return this.services;
    }
};

const formatCurrentHeatingCoolingState = function (val) {
    switch (val) {
        case Characteristic.CurrentHeatingCoolingState.OFF:
            return 'Off';
        case Characteristic.CurrentHeatingCoolingState.COOL:
            return 'Cooling';
        case Characteristic.CurrentHeatingCoolingState.HEAT:
            return 'Heating';
        default:
            return 'Off';
    }
};

const formatTargetHeatingCoolingState = function (val) {
    switch (val) {
        case Characteristic.TargetHeatingCoolingState.OFF:
            return 'Off';
        case Characteristic.TargetHeatingCoolingState.COOL:
            return 'Cool';
        case Characteristic.TargetHeatingCoolingState.HEAT:
            return 'Heat';
        case Characteristic.TargetHeatingCoolingState.AUTO:
            return 'Auto';
        default:
            return 'Off';
    }
};

const fahrenheitToCelsius = function (temperature) {
    return (temperature - 32) / 1.8;
};

const celsiusToFahrenheit = function (temperature) {
    return (temperature * 1.8) + 32;
};
let Service, Characteristic;

MiRemoteLearn = function(platform, config) {
  const {ip} = config;
  this.platform = platform;
  this.config = config;
  //this.platform.log.debug(`[MiLearn] Initializing learn: ${ip}`);
  return new MiRemoteLearnButton(this);
};

class MiRemoteLearnButton {
  constructor({config, platform}) {
    const {token, ip} = config;
    this.name = "MiLearn";
    this.token = token;
    this.platform = platform;

    this.readydevice = false;

    this.device = this.platform.getMiioDevice({address: ip, token}, this);

    Service = platform.HomebridgeAPI.hap.Service;
    Characteristic = platform.HomebridgeAPI.hap.Characteristic;

    this.updatetimere = false;
    this.timer;
    this.upt;
    this.MiRemoteLearnService;
    this.timekey;
  }

  getServices() {
    const serialNumber = this.token.substring(this.token.length - 8);
    const infoService = new Service.AccessoryInformation();
    infoService
      .setCharacteristic(Characteristic.Manufacturer, "XiaoMi")
      .setCharacteristic(Characteristic.Model, "ChuangMi IR Remote")
      .setCharacteristic(Characteristic.SerialNumber, serialNumber);

    const MiRemoteLearnButtonService = (this.MiRemoteLearnService = new Service.Switch(this.name));
    const MiRemoteLearnButtonOnCharacteristic = MiRemoteLearnButtonService.getCharacteristic(Characteristic.On);
    MiRemoteLearnButtonOnCharacteristic.on(
      "set",
      function(value, callback) {
        this.platform.log.info("[MiLearn] Learn Started");
        if (value === true) {
          this.updatetimere = true;
          this.upt = 5;
          this.updateTimer();
        }
        callback(null);
      }.bind(this)
    ).on(
      "get",
      function(callback) {
        callback(null, false);
      }.bind(this)
    );

    return [infoService, MiRemoteLearnButtonService];
  }

  updateTimer() {
    if (this.updatetimere && this.readydevice) {
      clearTimeout(this.timer);
      this.timer = setTimeout(
        function() {
          this.runTimer();
          this.updateTimer();
        }.bind(this),
        1 * 1000
      );
    } else {
      this.platform.log.info("[MiLearn] Learn Failed, Status Unready");
      setTimeout(
        function() {
          this.MiRemoteLearnService.getCharacteristic(Characteristic.On).updateValue(false);
        }.bind(this),
        3 * 100
      );
    }
  }

  runTimer() {
    const self = this;
    this.upt = this.upt - 1;
    if (this.upt <= 0) {
      this.updatetimere = false;
      this.MiRemoteLearnService.getCharacteristic(Characteristic.On).updateValue(false);
      self.platform.log.info("[MiLearn] Learn Stopped");
    } else {
      this.timekey = "123456789012345";
      if (this.upt == 4) {
        this.device
          .call("miIO.ir_learn", {key: this.timekey})
          .then(() => {
            self.platform.log.info("[MiLearn] MiLearn Waiting...");
          })
          .catch(function(err) {
            if (err == "Error: Call to device timed out") {
              self.platform.log.debug("[MiLearn] Remote Offline");
            } else {
              self.platform.log.debug(`[MiLearn] Error: ${err}`);
            }
          });
      } else {
        this.device
          .call("miIO.ir_read", {key: this.timekey})
          .then(result => {
            if (result["code"] !== "") {
              self.platform.log.info(`[MiLearn] Learned Code: ${result["code"]}`);
              this.updatetimere = false;
              this.upt = 0;
              this.MiRemoteLearnService.getCharacteristic(Characteristic.On).updateValue(false);
              self.platform.log.info("[MiLearn] Learn Success!");
            } else {
              self.platform.log.debug("[MiLearn] Learn Waiting...");
            }
          })
          .catch(function(err) {
            if (err === "Error: Call to device timed out") {
              self.platform.log.debug("[MiLearn] Remote Offline");
            } else {
              self.platform.log.error(`[MiLearn] Error: ${err}`);
            }
            callback(err);
          });
      }
      self.platform.log.debug(`[MiLearn] ${this.upt} Seconds left`);
    }
  }
}

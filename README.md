# [**Xiaomi IR Remote**](https://www.home-assistant.io/integrations/remote.xiaomi_miio) platform

A [`homebridge-plugin`](https://www.npmjs.com/search?q=keywords:homebridge-plugin) for **Mi Universal Remote** devices
: `chuangmi.ir.v2` `chuangmi.remote.h102a03` `chuangmi.remote.v2` `chuangmi.remote.h102c01`

![米家万能遥控器](http://cdn.cnbj1.fds.api.mi-img.com/mi-mall/6c94b247060499a08307809ab8dcf5e1.jpg)

> foaked from [`homebridge-mi-ir-remote`](https://www.npmjs.com/package/homebridge-mi-ir-remote/v/0.1.0) and [`homebridge-mi-ir-electrolux`](https://www.npmjs.com/package/homebridge-mi-ir-electrolux/v/0.2.2).

## Installation

Install [`homebridge`](https://github.com/nfarina/homebridge/blob/master/README.md).

```bash
sudo npm install -g --unsafe-perm homebridge
``` 

Install [`miio`](https://github.com/aholstenson/miio/blob/master/README.md) and the plugin packages.

```bash
sudo npm install -g miio homebridge-mi-remote
```

Get the [token](https://github.com/jghaanstra/com.xiaomi-miio/blob/master/docs/obtain_token.md) of your **Mi Universal Remote** device. Follow the [instruction](https://www.home-assistant.io/integrations/vacuum.xiaomi_miio/#retrieving-the-access-token).

```bash
miio --discover
```

Add the [configuration](#configuration) into the `config.json` file.

## Supported types

### MiLearn

Learn [raw codes](https://www.home-assistant.io/integrations/remote.xiaomi_miio/#raw) from each command by IR remote controllers. To obtain the code stored in the log file (e.g., `'/var/log/homebridge.log'`), run the _bash_ script as below:
```bash
tail <'/var/log/homebridge.log'> | grep -oe 'Learned Code:.*' | cut -d ' ' -f3 | tail -1
```

### Bundled accessories

See the [instruction](https://github.com/WestCoast5550/homebridge-mi-ir-remote/blob/master/README.md#supported-types) for details. 

* **Switch**
* **Light**
* **Projector**
* **AirConditioner**
* **Custom**
: Run multiple commands in a single switch. 
* **MomentarySwitch**
: Automatically turned off after 0.3 seconds. 

### Additional supported devices

* **LGAirConditioner**
: IR remote control for [**LG Home Air Conditioners**](https://www.lg.com/my/home-air-conditioners) (Heater/Cooler). Compatible with [AKB73835317](https://www.google.com/search?q=AKB73835317) [AKB73675605](https://www.google.com/search?q=AKB73675605). Also functional on LA090HSV4 LA120HSV4 LA180HSV4 LAN090HSV4 LAN120HSV4 LAN180HSV4 LS090HSV4 LS120HSV4 LS180HSV4 LSN090HSV4 LSN120HSV4 LSN180HSV4 LSU090HSV4 LSU120HSV4 LSU180HSV4 . 

## Configuration 

Example:
```json
"platforms": [
    {
        "platform": "MiRemote",
        "ip": "***.***.***.***",
        "token": "********************************",
        "hideLearn": false,
        "deviceCfgs": [
            {
                "type": "Switch",
                "data": {
                    
                }
            },
            {
                "type": "Projector",
                "data": {
                    
                }
            },
            {
                "type": "Light",
                "data": {
                    
                }
            },
            {
                "type": "AirConditioner",
                "data": {
                    
                }
            },
            {
                "type": "Custom",
                "data": {
                    
                }
            },
            {
                "type": "MomentarySwitch",
                "data": {
                    
                }
            },
            {
                "type": "lg-air-conditioner",
                "name": "Thermostat",
                "info": {
                    "Manufacturer": "LG Electronics Inc.",
                    "Model": "S-W096AAW",
                    "SerialNumber": "AKB73675605"
                },
                "hidePlasma": false,
                "hideJetPower": false,
                "hideLight": true
            }
        ]
    }
]
```

## Related websites
###

* [`python-miio`](https://github.com/rytilahti/python-miio): Python library & console tool for controlling Xiaomi smart appliances
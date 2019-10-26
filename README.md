# homebridge-mi-remote
 Mi Universal Remote plugin for homebridge
 - foaked from [WestCoast5550/homebridge-mi-ir-remote](https://github.com/WestCoast5550/homebridge-mi-ir-remote)

## Installation
 Install [`homebridge`](https://github.com/nfarina/homebridge/blob/master/README.md).
```
npm install -g --unsafe-perm homebridge
``` 
 Install [`miio`](https://github.com/aholstenson/miio/blob/master/README.md) and the plugin.
```
npm install -g miio homebridge-mi-remote
```
 Get token of your Mi Universal Remote device. See detailed [instructions](https://github.com/jghaanstra/com.xiaomi-miio/blob/master/docs/obtain_token.md).

## Supported Types
1. MiLearn
2. Bundled accessories
* Switch
* Light
* Projector
* AirConditioner
* Custom
* MomentarySwitch
 See detailed [instructions](https://github.com/WestCoast5550/homebridge-mi-ir-remote/blob/master/README.md) for details. 
3. Additional supproted devicesde:
* lg-air-conditioner: Remote control for LG Room Air Conditioner (Heater/Cooler). Compatible with AKB73835317 or AKB73675605(KR).
 Also functional on following models: LA090HSV4 LA120HSV4 LA180HSV4 LAN090HSV4 LAN120HSV4 LAN180HSV4 LS090HSV4 LS120HSV4 LS180HSV4 LSN090HSV4 LSN120HSV4 LSN180HSV4 LSU090HSV4 LSU120HSV4 LSU180HSV4 . 

## Configuration
```
"platforms": [
    {
        "platform": "MiRemote",
        "ip": "***.***.***.***",
        "token": "********************************",
        "hidelearn": false,
        "deviceCfgs": [
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

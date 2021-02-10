# Homebridge Weenect

A [Homebridge](https://homebridge.io/) plugin for [Weenect](https://www.weenect.com/) trackers.

## Installation

Just install the plugin in the [config-ui-x](https://github.com/oznu/homebridge-config-ui-x) plugin tab or with `npm i -g homebridge-weenect`. When using config-ui-x, the credentials can directly be entered in the plugins settings, alternatively modify your Homebridge configuration by adding the plugin under `platforms` like this:

```json
{
  "platform": "WeenectHomebridgePlugin",
  "username": "YOUR_WEENECT_USERNAME",
  "password": "YOUR_WEENECT_PASSWORD",
  "lowBatteryThreshold": 30,
  "updateInterval": 2
}
```


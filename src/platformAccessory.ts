import {
  Service,
  PlatformAccessory,
  CharacteristicGetCallback,
} from 'homebridge'

import { WeenectHomebridgePlatform } from './platform'

export interface TrackerInfo {
  id: string
  name: string
  type: string
  firmware: string
  imei: number
  battery: number
  online: boolean
  latitude: number
  longitude: number
}

export interface TrackerPosition {
  battery: number
  online: boolean
  latitude: number
  longitude: number
}

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class TrackerPlatformAccessory {
  private service: Service

  constructor(
    private readonly platform: WeenectHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    const { info } = this.accessory.context as { info: TrackerInfo }
    // set accessory information
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Weenect')
      .setCharacteristic(this.platform.Characteristic.Model, info.type)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, info.imei)
      .setCharacteristic(
        this.platform.Characteristic.FirmwareRevision,
        info.firmware,
      )

    // get the Battery service if it exists, otherwise create a new Battery service
    this.service =
      this.accessory.getService(this.platform.Service.BatteryService) ||
      this.accessory.addService(this.platform.Service.BatteryService)

    this.service
      .getCharacteristic(this.platform.Characteristic.BatteryLevel)
      .on('get', this.getBattery.bind(this))

    this.service
      .getCharacteristic(this.platform.Characteristic.ChargingState)
      .on('get', this.getChargingState.bind(this))

    this.service
      .getCharacteristic(this.platform.Characteristic.StatusLowBattery)
      .on('get', this.getStatusLowBattery.bind(this))

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, info.name)

    // register handlers for the On/Off Characteristic
    this.service
      .getCharacteristic(this.platform.Characteristic.On)
      .on('get', this.getOn.bind(this)) // GET - bind to the `getOn` method below
  }

  getBattery(callback: CharacteristicGetCallback) {
    const { battery } = this.accessory.context.info as TrackerInfo
    this.platform.log.debug('Get Characteristic Battery ->', battery)

    callback(null, battery)
  }

  getChargingState(callback: CharacteristicGetCallback) {
    callback(null, this.platform.Characteristic.ChargingState.NOT_CHARGING)
  }

  getStatusLowBattery(callback: CharacteristicGetCallback) {
    const { battery } = this.accessory.context.info as TrackerInfo
    const { lowBatteryThreshold = 30 } = this.platform.config
    const {
      BATTERY_LEVEL_LOW,
      BATTERY_LEVEL_NORMAL,
    } = this.platform.Characteristic.StatusLowBattery
    const lowBattery =
      battery <= lowBatteryThreshold ? BATTERY_LEVEL_LOW : BATTERY_LEVEL_NORMAL

    this.platform.log.debug(
      'Get Characteristic Status Low Battery ->',
      lowBattery,
    )

    callback(null, lowBattery)
  }

  getOn(callback: CharacteristicGetCallback) {
    const { online } = this.accessory.context.info as TrackerInfo
    this.platform.log.debug('Get Characteristic On ->', online)

    callback(null, online)
  }
}

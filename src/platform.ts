import {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig as BasePlatformConfig,
  Service,
  Characteristic,
} from 'homebridge'
import fetch from 'node-fetch'

import { PLATFORM_NAME, PLUGIN_NAME } from './settings'
import {
  TrackerPlatformAccessory,
  TrackerInfo,
  TrackerPosition,
} from './platformAccessory'

interface PlatformConfig extends BasePlatformConfig {
  username: string
  password: string
  lowBatteryThreshold: number
  updateInterval: number
}

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class WeenectHomebridgePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service
  public readonly Characteristic: typeof Characteristic = this.api.hap
    .Characteristic

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = []

  private authToken: string | null = null
  private authTokenValidUntil: Date | null = null

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', PLATFORM_NAME)

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', async () => {
      log.debug('Executed didFinishLaunching callback')

      // discover all trackers initially and restore
      // cached accessories with new data
      await this.discoverDevices()
      // this.updateTrackerInfos()

      // Update every n minutes
      const { updateInterval = 2 } = this.config
      setInterval(() => {
        this.updateTrackerInfos()
      }, updateInterval * 60000)
    })
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName)

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory)
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  async discoverDevices() {
    const trackerInfos = await this.getTrackerInfos()

    // this.accessories.forEach(accessory => {
    //   this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    // });

    // loop over the discovered devices and register each one if it has not already been registered
    for (const info of trackerInfos) {
      // generate a unique id for the accessory this should be generated from
      // something globally unique, but constant, for example, the device serial
      // number or MAC address
      const uuid = this.api.hap.uuid.generate(info.id)

      // see if an accessory with the same uuid has already been registered and restored from
      // the cached devices we stored in the `configureAccessory` method above
      const existingAccessory = this.accessories.find(
        (accessory) => accessory.UUID === uuid,
      )

      if (existingAccessory) {
        // the accessory already exists
        this.log.info(
          'Restoring existing accessory from cache:',
          existingAccessory.displayName,
        )

        // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
        existingAccessory.context.info = info
        this.api.updatePlatformAccessories([existingAccessory])

        // create the accessory handler for the restored accessory
        // this is imported from `platformAccessory.ts`
        new TrackerPlatformAccessory(this, existingAccessory)
      } else {
        // the accessory does not yet exist, so we need to create it
        this.log.info('Adding new accessory:', info.name)

        // create a new accessory
        const accessory = new this.api.platformAccessory(info.name, uuid)

        // store a copy of the info object in the `accessory.context`
        // the `context` property can be used to store any data about the accessory you may need
        accessory.context.info = info

        // create the accessory handler for the newly create accessory
        // this is imported from `platformAccessory.ts`
        new TrackerPlatformAccessory(this, accessory)

        // link the accessory to your platform
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
          accessory,
        ])
      }
    }
  }

  async updateTrackerInfos() {
    this.log.debug('Updating trackers...')
    try {
      // Get a list of all trackers infos
      const infos = await this.getTrackerInfos()
      // For each tracker info...
      // this.log.debug('updates', infos, this.trackers);
      for (const info of infos) {
        // ...check if the tracker was already registered
        const uuid = this.api.hap.uuid.generate(info.id)
        const existingAccessory = this.accessories.find(
          (accessory) => accessory.UUID === uuid,
        )
        if (!existingAccessory) {
          this.log.debug(`Adding newly found tracker "${info.name}"`)
          // register the newly found tracker
          const accessory = new this.api.platformAccessory(info.name, uuid)
          // store a copy of the info object in the `accessory.context`
          // the `context` property can be used to store any data about the accessory you may need
          accessory.context.info = info
          // create the accessory handler for the newly create accessory
          // this is imported from `platformAccessory.ts`
          new TrackerPlatformAccessory(this, accessory)
          // link the accessory to the platform
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
            accessory,
          ])
        } else {
          this.log.debug(`Updating tracker "${info.name}"`)
          existingAccessory.context.info = info
          this.api.updatePlatformAccessories([existingAccessory])
        }
      }
      // Go over each accessory and check if the tracker is still listed
      // otherwise unregister it
      this.accessories.forEach((accessory) => {
        const { id, name } = accessory.context.info
        const stillExists = !!infos.find((info) => info.id === id)
        if (!stillExists) {
          this.log.debug(`Removing tracker "${name}"`)
          this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
            accessory,
          ])
        }
      })
    } catch (err) {
      this.log.error('Could not update trackers', err)
    }
  }

  async getTrackerInfos() {
    const token = await this.login()
    const res = await fetch('https://apiv4.weenect.com/v4/mytracker', {
      headers: {
        authorization: `JWT ${token}`,
      },
    })
    const result = await res.json()
    const { items } = result
    return items.map(({ name, id, position, type, imei, firmware }) => ({
      name,
      // id: position[0].id,
      id: `${id}`,
      battery: position[0].battery,
      online: position[0].is_online,
      type,
      imei,
      latitude: position[0].latitude,
      longitude: position[0].longitude,
      firmware,
    })) as TrackerInfo[]
  }

  /**
   * Not used at the moment because it would
   * require a request for each tracker in contrary to
   * getTrackerInfos (which on the other hand returns much more unused data)
   * ...furthermore getTrackerInfos will probably also reflect removed trackers directly
   * @param id
   */
  async getTrackerPosition(id: string) {
    const token = await this.login()
    const res = await fetch(
      `https://apiv4.weenect.com/v4/mytracker/${id}/position`,
      {
        headers: {
          authorization: `JWT ${token}`,
        },
      },
    )
    const result = await res.json()
    const { battery, latitude, longitude, type /* , is_online: online */ } = result[0]
    const turnedOff = typeof type === 'string' && type.toLocaleLowerCase().indexOf('off') >= 0
    return {
      battery,
      online: !turnedOff,
      latitude,
      longitude,
    } as TrackerPosition
  }

  async login() {
    const now = new Date().getTime()
    const { authToken, authTokenValidUntil } = this
    // Check if the token has to be renewed
    if (
      !authToken ||
      !authTokenValidUntil ||
      authTokenValidUntil.getTime() < now
    ) {
      const { username, password } = this.config
      const res = await fetch('https://apiv4.weenect.com/v4/user/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
        }),
      })
      const result = await res.json()
      const { access_token: token, expires_in /*, refresh_token: */ } = result
      this.authToken = token as string
      const validUntil = new Date()
      validUntil.setSeconds(validUntil.getSeconds() + expires_in)
      this.authTokenValidUntil = validUntil
      this.log.debug(
        `Got new access token (valid until: ${this.authTokenValidUntil.toLocaleString()})`,
      )
      return this.authToken
    }
    return authToken
  }
}

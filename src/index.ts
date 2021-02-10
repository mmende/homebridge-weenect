import { API } from 'homebridge'

import { PLUGIN_NAME, PLATFORM_NAME } from './settings'
import { WeenectHomebridgePlatform } from './platform'

/**
 * This method registers the platform with Homebridge
 */
export = (api: API) => {
  // @ts-ignore
  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, WeenectHomebridgePlatform)
}

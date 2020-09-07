import { API } from 'homebridge'

import { PLATFORM_NAME } from './settings'
import { WeenectHomebridgePlatform } from './platform'

/**
 * This method registers the platform with Homebridge
 */
export = (api: API) => {
  // @ts-ignore
  api.registerPlatform(PLATFORM_NAME, WeenectHomebridgePlatform)
}

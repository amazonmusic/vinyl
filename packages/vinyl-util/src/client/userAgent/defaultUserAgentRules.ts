/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { UserAgentRules } from './tokenizeUserAgent'
import type { UaDeviceInfo } from './UserAgentInfo'
import {
    regexRule,
    uaDeviceRule as device,
    uaPlatformOrSystemRule as platformOrSystem,
    uaPlatformRule as platform,
    uaSystemLike,
    uaSystemRule as system,
} from './userAgentRuleHelpers'

/**
 * An enumeration of operating systems that can be detected from the user agent.
 */
export enum Os {
    ANDROID = 'Android',
    ANDROID_OSP = 'Android OSP',
    CHROME_OS = 'chromeOS',
    CHROMECAST = 'Chromecast',
    FEDORA = 'Fedora',
    FIREFOX_OS = 'Firefox OS', // Firefox OS (legacy) does not have a differentiable user agent
    FIRE_OS = 'Fire OS',
    FREE_BSD = 'FreeBSD',
    HARMONY_OS = 'HarmonyOS',
    I_OS = 'iOS',
    KAIOS = 'KaiOS', // Based on the discontinued Firefox OS
    LINUX = 'Linux',
    MAC_OS = 'macOS',
    MIUI = 'MIUI',
    ORBIS = 'Orbis OS',
    SMART_CAST = 'SmartCast',
    SYMBIAN = 'Symbian',
    TIZEN = 'Tizen',
    UBUNTU = 'Ubuntu',
    VEGA = 'Vega',
    WEB_OS = 'webOS',
    WINDOWS = 'Windows',
    WINDOWS_PHONE = 'Windows Phone',
}

/**
 * An enumeration of browsers that can be detected from the user agent.
 */
export enum Browser {
    BRAVE = 'Brave',
    CHROME = 'Chrome',
    CHROME_HEADLESS = 'Chrome Headless',
    CHROMIUM = 'Chromium',
    DUCK_DUCK_GO = 'DuckDuckGo',
    EDGE_CHROMIUM = 'Edge Chromium',
    EDGE_LEGACY = 'Edge Legacy',
    ELECTRON = 'Electron',
    FIREFOX = 'Firefox',
    HUAWEI = 'Huawei',
    IE = 'IE',
    IE_MOBILE = 'IE Mobile', // AKA Pocket Internet Explorer
    OCULUS = 'Oculus Browser',
    OPENWAVE = 'Openwave',
    OPERA = 'Opera',
    OPERA_TOUCH = 'Opera Touch',
    QUARK = 'Quark',
    SILK = 'Silk',
    SAFARI = 'Safari',
    SAMSUNG_BROWSER = 'Samsung Browser',
    UC_BROWSER = 'UC Browser',
    WPE = 'WPE WebKit',
    YANDEX = 'Yandex',
    WEBKIT = 'WebKit',
}

export enum DeviceVendor {
    AMAZON = 'Amazon',
    APPLE = 'Apple',
    FACEBOOK = 'Facebook',
    GOOGLE = 'Google',
    HISENSE = 'Hisense',
    HTC = 'HTC',
    HUAWEI = 'Huawei',
    K = 'K',
    LG = 'LG',
    MEIZU = 'Meizu',
    MICROSOFT = 'Microsoft',
    MOTOROLA = 'Motorola',
    NINTENDO = 'Nintendo',
    NOKIA = 'Nokia',
    NVIDIA = 'Nvidia',
    ONE_PLUS = 'OnePlus',
    OPPO = 'OPPO',
    ROKU = 'Roku',
    SAMSUNG = 'Samsung',
    SKY = 'Sky',
    SKY_DEVICES = 'SKY Devices', // Not related to the set-top boxes.
    SONY = 'Sony',
    TESLA = 'Tesla',
    VIZIO = 'VIZIO',
}

export enum DeviceType {
    AUTOMOTIVE = 'automotive',
    CONSOLE = 'console',
    DESKTOP = 'desktop',
    SMART_TV = 'smarttv',
    MOBILE = 'mobile',
    WEARABLE = 'wearable',
}

export const defaultUserAgentRules: UserAgentRules = {
    browserRules: [
        // IE based:
        platform(Browser.EDGE_LEGACY, 'edge'),
        platformOrSystem(Browser.IE, 'msie|trident'),
        platformOrSystem(Browser.IE_MOBILE, 'iemobile'),

        // Firefox based:
        platform(Browser.FIREFOX, 'firefox|fxios'),

        // Chromium based:
        platformOrSystem(Browser.BRAVE, 'brave'),
        platform(Browser.DUCK_DUCK_GO, 'duckduckgo'),
        platform(Browser.EDGE_CHROMIUM, 'edg|edgios|edga'),
        platform(Browser.ELECTRON, 'electron'),
        platform(Browser.OCULUS, 'oculusbrowser'),
        platform(Browser.OPENWAVE, 'up.link|up.browser'),
        platform(Browser.OPERA, 'opr|opera'),
        platform(Browser.OPERA_TOUCH, 'opt'),
        platform(Browser.QUARK, 'quark'),
        platform(Browser.HUAWEI, 'huaweibrowser'),
        platform(Browser.SAMSUNG_BROWSER, 'samsungbrowser'),
        platform(Browser.SILK, 'silk'),
        platform(Browser.UC_BROWSER, 'ucbrowser'),
        platform(Browser.YANDEX, 'yasearchbrowser|yabrowser'),
        platform(Browser.CHROME_HEADLESS, 'headlesschrome'),
        platform(Browser.CHROMIUM, 'chromium'),
        platform(Browser.CHROME, 'chrome|crios'),

        // WebKit based:
        platform(Browser.WPE, 'wpe'),

        platform(Browser.SAFARI, 'safari&version'),
        platformOrSystem(Browser.SAFARI, 'like safari&version'),
    ],

    browserLikeRules: [
        uaSystemLike(Browser.WEBKIT, [Browser.SAFARI]),
        (t) =>
            // All iOS devices use WebKit
            t.system.query('iphone|ipad|ipod') &&
            t.platform.get('applewebkit') && {
                name: Browser.WEBKIT,
                version: null,
            },
        platformOrSystem(Browser.FIREFOX, 'firefox'),
        (t) => {
            const systemInfo = t.platform.query(
                'chrome|headlesschrome|crios|chromium'
            )
            if (systemInfo == null || t.platform.query('edge'))
                // Edge legacy
                return null
            return {
                name: Browser.CHROMIUM,
                version: systemInfo.version,
            }
        },
    ],

    osRules: [
        system(Os.WINDOWS_PHONE, 'windows phone', true),
        system(Os.WINDOWS, 'windows', true),
        system(Os.TIZEN, 'tizen', true),
        system(Os.I_OS, 'cpu os|iphone os', true),
        system(Os.MAC_OS, 'os x', true),
        system(Os.CHROME_OS, 'cros', true),
        platform(Os.SMART_CAST, 'smartcast'), // VIZIO SmartCast has built-in chromecast (CrKey)
        platformOrSystem(Os.CHROMECAST, 'crkey'),
        system(Os.WEB_OS, 'webos', true),
        system(Os.SYMBIAN, 'symbian', false),
        system(Os.HARMONY_OS, 'harmonyos', false),
        platformOrSystem(Os.MIUI, 'linux&xiaomi'),
        platformOrSystem(Os.FIRE_OS, 'fireos'),
        system(Os.ANDROID, 'android', true),
        system(Os.FREE_BSD, 'freebsd', false),
        system(Os.FEDORA, 'fedora', false),
        system(Os.ORBIS, 'orbis|playstation', false),
        system(Os.UBUNTU, 'ubuntu', false),
        system(Os.VEGA, 'kepler', false),
        system(Os.LINUX, 'linux', false),
        platform(Os.KAIOS, 'kaios'), // [sic] KAIOS is in platform section
    ],

    osLikeRules: [
        system(Os.ANDROID_OSP, 'android', true),
        uaSystemLike(Os.ANDROID_OSP, [
            Os.ANDROID,
            Os.HARMONY_OS,
            Os.FIRE_OS,
            Os.MIUI,
        ]),
        uaSystemLike(Os.FIREFOX_OS, [Os.KAIOS]),
        uaSystemLike(Os.LINUX, [
            Os.FREE_BSD,
            Os.FEDORA,
            Os.ORBIS,
            Os.UBUNTU,
            Os.LINUX,
        ]),
    ],

    deviceRules: [
        // Desktop

        device(DeviceVendor.APPLE, DeviceType.DESKTOP, 'macintosh'),

        // Mobile

        device(DeviceVendor.APPLE, DeviceType.MOBILE, 'iphone|ipod|ipad'),
        device(DeviceVendor.SAMSUNG, DeviceType.MOBILE, 'sm|samsung'),
        device(DeviceVendor.GOOGLE, DeviceType.MOBILE, 'pixel|nexus'),
        device(DeviceVendor.HUAWEI, DeviceType.MOBILE, 'ine'),
        device(DeviceVendor.HTC, DeviceType.MOBILE, 'htc'),
        device(DeviceVendor.MEIZU, DeviceType.MOBILE, 'meizu'),
        device(DeviceVendor.ONE_PLUS, DeviceType.MOBILE, 'oneplus'),
        device(
            DeviceVendor.MOTOROLA,
            DeviceType.MOBILE,
            'mot|motorola|motorizr'
        ),
        device(DeviceVendor.NOKIA, DeviceType.MOBILE, 'nokia'),
        device(DeviceVendor.OPPO, DeviceType.MOBILE, 'oppo'),
        device(DeviceVendor.AMAZON, DeviceType.MOBILE, 'kindle'),
        device(DeviceVendor.NVIDIA, DeviceType.MOBILE, 'shield tablet'),
        device(DeviceVendor.K, DeviceType.MOBILE, 'android&k'),
        device(DeviceVendor.LG, DeviceType.MOBILE, 'android&mobile&lg'),
        device(DeviceVendor.SKY_DEVICES, DeviceType.MOBILE, 'android&sky'),

        // Consoles

        device(DeviceVendor.SONY, DeviceType.CONSOLE, 'playstation'),
        device(DeviceVendor.MICROSOFT, DeviceType.CONSOLE, 'xbox one|xbox'),
        device(DeviceVendor.NINTENDO, DeviceType.CONSOLE, 'switch|nintendo'),

        // Wearables

        device(DeviceVendor.APPLE, DeviceType.WEARABLE, 'airwatch'),
        device(DeviceVendor.FACEBOOK, DeviceType.WEARABLE, 'quest'),

        // Smart TVs:

        device(DeviceVendor.AMAZON, DeviceType.SMART_TV, 'afts|aftwmst'),
        device(DeviceVendor.APPLE, DeviceType.SMART_TV, 'appletv'),
        device(DeviceVendor.GOOGLE, DeviceType.SMART_TV, 'nexus player'),
        device(DeviceVendor.HISENSE, DeviceType.SMART_TV, 'hisense'),
        device(DeviceVendor.LG, DeviceType.SMART_TV, 'lg'),
        device(DeviceVendor.ROKU, DeviceType.SMART_TV, 'roku'),
        device(DeviceVendor.AMAZON, DeviceType.SMART_TV, 'kepler'),
        regexRule<UaDeviceInfo>(/linux.*\(sky,\s*(\w+)/i, (match) => {
            return {
                vendor: DeviceVendor.SKY,
                model: match[1],
                type: DeviceType.SMART_TV,
            }
        }),
        regexRule<UaDeviceInfo>(
            /vizio smartcast.+model\/([\w-]+)/i,
            (match) => {
                return {
                    vendor: DeviceVendor.VIZIO,
                    model: match[1],
                    type: DeviceType.SMART_TV,
                }
            }
        ),

        device(DeviceVendor.VIZIO, DeviceType.SMART_TV, 'vizio'),
        device(DeviceVendor.GOOGLE, DeviceType.SMART_TV, 'crkey', 'Chromecast'),

        // Automotive:

        device(DeviceVendor.TESLA, DeviceType.AUTOMOTIVE, 'tesla'),

        // Generic

        // WPE is a WebKit browser designed for embedded systems:
        device(null, DeviceType.SMART_TV, 'wpe', null),

        device(null, DeviceType.MOBILE, 'mobile|android', null),
        device(null, DeviceType.DESKTOP, 'windows|linux|cros', null),
    ],
}

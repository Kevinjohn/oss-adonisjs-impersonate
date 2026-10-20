import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'masquerade.status': { paramsTuple?: []; params?: {} }
    'masquerade.start': { paramsTuple?: []; params?: {} }
    'masquerade.stop': { paramsTuple?: []; params?: {} }
    'demo.workspace': { paramsTuple?: []; params?: {} }
    'demo.start': { paramsTuple?: []; params?: {} }
    'demo.stop': { paramsTuple?: []; params?: {} }
    'demo.customer': { paramsTuple?: []; params?: {} }
    'demo.preference': { paramsTuple?: []; params?: {} }
    'demo.sensitive': { paramsTuple?: []; params?: {} }
    'home': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'new_account.store': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'session.store': { paramsTuple?: []; params?: {} }
    'dashboard': { paramsTuple?: []; params?: {} }
    'logout': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'masquerade.status': { paramsTuple?: []; params?: {} }
    'demo.workspace': { paramsTuple?: []; params?: {} }
    'demo.customer': { paramsTuple?: []; params?: {} }
    'home': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'dashboard': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'masquerade.status': { paramsTuple?: []; params?: {} }
    'demo.workspace': { paramsTuple?: []; params?: {} }
    'demo.customer': { paramsTuple?: []; params?: {} }
    'home': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'dashboard': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'masquerade.start': { paramsTuple?: []; params?: {} }
    'masquerade.stop': { paramsTuple?: []; params?: {} }
    'demo.start': { paramsTuple?: []; params?: {} }
    'demo.stop': { paramsTuple?: []; params?: {} }
    'demo.preference': { paramsTuple?: []; params?: {} }
    'demo.sensitive': { paramsTuple?: []; params?: {} }
    'new_account.store': { paramsTuple?: []; params?: {} }
    'session.store': { paramsTuple?: []; params?: {} }
    'logout': { paramsTuple?: []; params?: {} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}
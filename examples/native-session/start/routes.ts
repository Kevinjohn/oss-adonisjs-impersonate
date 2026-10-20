import { shareMasquerade } from 'adonisjs-masquerade/http'
import { middleware } from '#start/kernel'
import Session from '#controllers/session_controller'
import NewAccount from '#controllers/new_account_controller'
import router from '@adonisjs/core/services/router'

import './masquerade_control_routes.js'
import './test_routes.js'

const controllers = { Session, NewAccount }

router.on('/').render('pages/home').as('home')

router
  .group(() => {
    router.get('signup', [controllers.NewAccount, 'create'])
    router.post('signup', [controllers.NewAccount, 'store'])
    router.get('login', [controllers.Session, 'create'])
    router.post('login', [controllers.Session, 'store'])
  })
  .use(middleware.guest())

router
  .on('/dashboard')
  .render('pages/dashboard')
  .as('dashboard')
  .use(middleware.auth({ guards: ['web_effective'] }))

router
  .post('/logout', [controllers.Session, 'destroy'])
  .as('logout')
  .use(middleware.auth({ guards: ['web'] }))

router
  .get('/business/form', async (ctx) => {
    await shareMasquerade(ctx)
    return ctx.view.render('pages/masquerade_form')
  })
  .use(middleware.auth({ guards: ['web_effective'] }))

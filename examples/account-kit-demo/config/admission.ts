import { defineAdmission } from 'adonisjs-account-kit/admission'

export default defineAdmission({
  approval: {
    required: true,
    authorize: {
      decide: async () => true,
      list: async () => true,
    },
  },
})

export default defineNuxtRouteMiddleware(async (to) => {
  const { loggedIn, user } = useUserSession()

  if (!loggedIn.value) {
    return navigateTo('/login')
  }

  if (to.path.startsWith('/admin') && user.value?.role !== 'ADMIN') {
    return navigateTo('/login')
  }
})

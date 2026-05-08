import { auth, currentUser } from '@clerk/nextjs/server'

export interface ClerkUser {
    email: string
    firstName: string | null
    lastName: string | null
}

export async function getClerkUser(): Promise<ClerkUser | null> {
    const { userId } = await auth()
    if (!userId) return null

    const user = await currentUser()
    if (!user) return null

    const primaryEmail = user.emailAddresses.find(
        (e) => e.id === user.primaryEmailAddressId
    )
    if (!primaryEmail) return null

    return {
        email: primaryEmail.emailAddress,
        firstName: user.firstName,
        lastName: user.lastName,
    }
}

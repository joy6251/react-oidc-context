import React from "react"
import { UserManager, UserManagerSettings, User } from "oidc-client"

import { AuthContext } from "./AuthContext"
import { initialAuthState } from "./AuthState"
import { reducer } from "./reducer"
import { hasAuthParams } from "./utils"

export interface AuthProviderProps extends UserManagerSettings {
    /**
     * The child nodes your Provider has wrapped
     */
    children?: React.ReactNode

    /**
     * On sign out hook. Can be a async function.
     * @param user User
     */
    onSignIn?: (user: User | null) => Promise<void> | void

    /**
     * On sign out hook. Can be a async function.
     */
    onSignOut?: () => Promise<void> | void

    /**
     * By default, if the page url has code/state params, the SDK will call automatically the userManager.signinCallback.
     * In some cases the code might be for something else (another OAuth SDK perhaps). In these
     * instances you can instruct the client to ignore them eg
     *
     * ```jsx
     * <AuthProvider
     *   skipSigninCallback={window.location.pathname === '/stripe-oauth-callback'}
     * >
     * ```
     */
    skipSigninCallback?: boolean
}

/**
 * Provides the AuthContext to its child components.
 */
export const AuthProvider = (props: AuthProviderProps): JSX.Element => {
    const {
        children,

        onSignIn,
        onSignOut,
        skipSigninCallback,

        ...userManagerProps
    } = props

    const [userManager] = React.useState<UserManager>(() => new UserManager(userManagerProps))
    const [state, dispatch] = React.useReducer(reducer, initialAuthState)

    React.useEffect(() => {
        const initialise = async (): Promise<void> => {
            try {
                // check if returning back from authority server
                if (hasAuthParams() && !skipSigninCallback) {
                    const user = await userManager.signinCallback()
                    onSignIn && onSignIn(user)
                }
            } catch (error) {
                dispatch({ type: "ERROR", error })
            }

            const user = await userManager.getUser()
            dispatch({ type: "INITIALISED", user })
        }
        initialise()
    }, [userManager, skipSigninCallback, onSignIn])

    // register to userManager events
    React.useEffect(() => {
        // event UserLoaded (e.g. initial load, silent renew success)
        const handleUserLoaded = () => {
            (async () => {
                const user = await userManager.getUser()
                dispatch({ type: "USER_LOADED", user })
            })()
        }
        userManager.events.addUserLoaded(handleUserLoaded)

        // event UserUnloaded (e.g. userManager.removeUser)
        const handleUserUnloaded = () => {
            dispatch({ type: "USER_UNLOADED" })
        }
        userManager.events.addUserUnloaded(handleUserUnloaded)

        // event SilentRenewError (silent renew error)
        const handleSilentRenewError = (error: Error) => {
            dispatch({ type: "ERROR", error })
        }
        userManager.events.addSilentRenewError(handleSilentRenewError)

        return () => {
            userManager.events.removeUserLoaded(handleUserLoaded)
            userManager.events.removeUserUnloaded(handleUserUnloaded)
            userManager.events.removeSilentRenewError(handleSilentRenewError)
        }
    }, [userManager])

    const signInRedirect = React.useCallback(
        async (args: any): Promise<void> => {
            await userManager.signinRedirect(args)
        },
        [userManager]
    )

    const signOut = React.useCallback(
        async (): Promise<void> => {
            await userManager.removeUser()
            onSignOut && onSignOut()
        },
        [userManager, onSignOut]
    )

    const signOutRedirect = React.useCallback(
        async (args?: any): Promise<void> => {
            await userManager.signoutRedirect(args)
            onSignOut && onSignOut()
        },
        [userManager, onSignOut]
    )

    return (
        <AuthContext.Provider
            value={{
                ...state,
                userManager,
                signInRedirect,
                signOut,
                signOutRedirect,
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}
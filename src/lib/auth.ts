import * as jose from 'jose'

function getSecretKey() {
    const secretKey = process.env.JWT_SECRET
    if (!secretKey) {
        throw new Error('JWT_SECRET environment variable is required. Set it in your .env file or Railway dashboard.')
    }
    return new TextEncoder().encode(secretKey)
}

export async function encrypt(payload: any) {
    const key = getSecretKey()
    return await new jose.SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1d')
        .sign(key)
}

export async function decrypt(token: string): Promise<any> {
    try {
        const key = getSecretKey()
        const { payload } = await jose.jwtVerify(token, key, {
            algorithms: ['HS256'],
        })
        return payload
    } catch (error) {
        return null
    }
}


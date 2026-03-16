import * as jose from 'jose'

const secretKey = process.env.JWT_SECRET || 'atelier-optica-super-secret-key-for-dev'
const key = new TextEncoder().encode(secretKey)

export async function encrypt(payload: any) {
    return await new jose.SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1d')
        .sign(key)
}

export async function decrypt(token: string): Promise<any> {
    try {
        const { payload } = await jose.jwtVerify(token, key, {
            algorithms: ['HS256'],
        })
        return payload
    } catch (error) {
        return null
    }
}

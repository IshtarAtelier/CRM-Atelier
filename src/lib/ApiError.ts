export class ApiError extends Error {
    public statusCode: number;
    public errors?: any;

    constructor(message: string, statusCode: number = 500, errors?: any) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.errors = errors;
        Error.captureStackTrace(this, this.constructor);
    }
}

export function handleApiError(error: unknown) {
    console.error('[API Error]:', error);

    if (error instanceof ApiError) {
        return Response.json(
            { error: error.message, details: error.errors },
            { status: error.statusCode }
        );
    }

    if (error instanceof Error) {
        return Response.json(
            { error: error.message },
            { status: 500 }
        );
    }

    return Response.json(
        { error: 'An unexpected error occurred' },
        { status: 500 }
    );
}

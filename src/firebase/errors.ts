// A custom error class to provide more context on Firestore permission errors.
// This is used to display a more helpful error message to the developer.

export type SecurityRuleContext = {
    path: string;
    operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
    requestResourceData?: any;
};

export class FirestorePermissionError extends Error {
    public context: SecurityRuleContext;
    constructor(context: SecurityRuleContext) {
        const message = `FirestoreError: Missing or insufficient permissions: The following request was denied by Firestore Security Rules:
${JSON.stringify(
    {
        operation: context.operation,
        path: context.path,
        requestData: context.requestResourceData,
    },
    null,
    2
)}`;
        super(message);
        this.name = 'FirestorePermissionError';
        this.context = context;
        Object.setPrototypeOf(this, FirestorePermissionError.prototype);
    }
}

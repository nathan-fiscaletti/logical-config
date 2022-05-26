const isCallable = item => typeof item === 'function';

const isFunction = funcOrClass => {
    const propertyNames = Object.getOwnPropertyNames(funcOrClass);
    return !propertyNames.includes('prototype')
           || propertyNames.includes('arguments');
};

const tryResolveDotPath = (dotMap, obj) => 
    typeof dotMap === 'string' ? dotMap.split('.').reduce(
        (a, b, ) => a ? a[b] : undefined, obj
    ) : undefined;

const isShortHand = obj => (
    typeof obj === 'string' &&
    obj.startsWith('{') &&
    obj.endsWith('}')
);

const isValidPathObject = obj => (
    obj
    && obj.path 
    && typeof obj.path === 'string'
    && (
        typeof obj.call === 'boolean' 
        || obj.call == undefined
    )
    && (
        (
            typeof obj.parameters === 'object'
            && Array.isArray(obj.parameters)
        ) || obj.parameters === undefined
    )
);

const parsePathObject = obj => {
    if (isValidPathObject(obj)) {
        return obj;
    }

    if (isShortHand(obj)) {
        const elems = obj.slice(1, -1).split(';');
        const [ path, params, call ] = elems;

        const parameters = params && params.length > 0 ? JSON.parse(params) : undefined;

        return {
            path,
            parameters,
            call: ['true', 'false'].includes(call) ? call === 'true' : undefined
        };
    }

    return {};
};

const shouldCall = (obj, def = true) => obj.call === undefined ? def : obj.call;

const isResolved = (obj, resolved) => {
    if(resolved === undefined) {
        throw new Error(`Referenced path '${obj.path || obj}' is not accessble.`);
    }

    if (!isCallable(resolved) && shouldCall(obj, false)) {
        throw new Error(`Referencing '${obj.path || obj}' with 'call' enabled, but referenced path is not callable.`);
    }

    if (isCallable(resolved) && shouldCall(obj, false)) {
        const requiredLength = (
            isFunction(resolved)
                ? /* function */ resolved
                : /* class    */ resolved.prototype.constructor || []
        ).length;

        const providedLength = (obj.parameters || []).length

        if (shouldCall(obj, true) && providedLength !== requiredLength) {
            throw new Error(`Referencing '${obj.path || obj}' but an invalid number of parameters was passed to it. (provided ${providedLength}, required ${requiredLength})`);
        }
    }

    return true;
};

const tryMakeReferenceable = (obj, resolved) => (
    !isValidPathObject(obj) ? { isReferenceable: false, getReference: undefined } : (
        !isResolved(obj, resolved) ? { isReferenceable: false, getReference: undefined } : { isReferenceable: true, getReference: (
            !isCallable(resolved) ? async () => resolved :
                !shouldCall(obj, true) ? async () => resolved
                    : isFunction(resolved)
                        ? /* call function     */ async () => await resolved(...(obj.parameters || []))
                        : /* instantiate class */ async () => new resolved(...(obj.parameters || []))            
        )}
    )
);

const fill = async (input, map) => {
    if (!['string', 'object'].includes(typeof input)) {
        return input;
    }

    const parsed = parsePathObject(input);
    const {
        isReferenceable: _isDataReferenceable,
        getReference: _getDataReference
    } = tryMakeReferenceable(parsed, tryResolveDotPath(parsed.path, map));
    if (_isDataReferenceable) {
        return await _getDataReference();
    }

    if (typeof input === 'string') {
        return input;
    }

    if (Array.isArray(input)) {
        return await Promise.all(data.map(async e => await fill(e, map)));
    }

    return Object.fromEntries(
        await Promise.all(Object.entries(input).map(async ([k, v]) => {
            const parsed = parsePathObject(v);
            const {
                isReferenceable: _isItemReferenceable,
                getReference: _getItemReference
            } = tryMakeReferenceable(parsed, tryResolveDotPath(parsed.path || v, map));
            return [k, (
                _isItemReferenceable
                    ? await _getItemReference()
                    : await fill(v, map)
            )];
        }))
    );
}

module.exports = { fill, parsePathObject };

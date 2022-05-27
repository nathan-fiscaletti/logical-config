/**
 * Deter,ome of the provided item is callable. Callable items have the type
 * function. These are normally either functions or classes.
 *
 * @param {any} item the item
 * @returns True if the item is callable, false otherwise.
 */
const isCallable = item => typeof item === 'function';

/**
 * Determine if the provided object is a function. You should first call the
 * {@link isCallable} funuction to verify that the item is callable.
 *
 * @param {Function|class} item the class or function.
 * @returns True if the provided object is a function.
 */
const isFunction = item => {
    const propertyNames = Object.getOwnPropertyNames(item);
    return !propertyNames.includes('prototype')
           || propertyNames.includes('arguments');
};

/**
 * Attempts to resolve the specified `dotPath` down to the corresponding
 * value in the `obj`.
 *
 * @param {string} dotPath The dot path to resolve.
 * @param {object} obj The object to resolve the path in.
 * @returns the value found, or undefined if one was not found
 */
const tryResolveDotPath = (dotPath, obj) => 
    typeof dotPath === 'string' ? dotPath.split('.').reduce(
        (a, b, ) => a ? a[b] : undefined, obj
    ) : undefined;

/**
 * Determine if the specified string is a properly formatted short-hand path-object.
 *
 * @param {any} obj the object to test
 * @returns true if the object is properly formatted, false otherwise.
 */
const isShortHand = obj => (
    typeof obj === 'string'
    && /^\{[^;\n]{1,}(|;|;\[[^\n]*\])(|;|;(true|false))\}$/.test(obj)
);

/**
 * Determines if the specified object is a valid path-object.
 *
 * @param {any} obj the object
 * @returns true if the object is a valid path-object, false otherwise.
 */
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

/**
 * Parses a path-object.
 *
 * @param {any} obj the input object
 * @returns a path-object provided that the input object is either a
 *          properly formatted short-hand path object, or an already
 *          parsed path-object.
 */
const parsePathObject = obj => {
    let result;

    if (isValidPathObject(obj)) {
        result = { ...obj, supportsNested: true };
    }

    if (result === undefined && isShortHand(obj)) {
        const elems = obj.slice(1, -1).split(';');
        const [ path, params, call ] = elems;

        const parameters = params && params.length > 0 
            ? JSON.parse(params)
            : undefined;

        result = {
            path,
            parameters,
            call: ['true', 'false'].includes(call) ? call === 'true' : undefined
        };
    }

    return result || {};
};

/**
 * Retrieves the specified value.
 *
 * @param {} obj the value to retrieve
 * @param {*} def the default to return if the value is undefined
 * @returns the value
 */
const getDef = (obj, def = true) => obj === undefined ? def : obj;

/**
 * Validates that the specified path-object has the required
 * data to express the resolved symbol.
 *
 * @param {object} obj the path-object
 * @param {any} resolved the resolved-symbol
 * @returns true if the path-object expresses the symbol
 * @throws if the path-object does not express the symbol
 */
const pathObjectExpressesSymbol = (obj, resolved) => {
    if(resolved === undefined) {
        throw new Error(`Referenced path '${obj.path || obj}' is not accessble.`);
    }

    if (!isCallable(resolved) && getDef(obj.call, false)) {
        throw new Error(
            `Referencing '${obj.path || obj}' with 'call' enabled, ` +
            `but referenced path is not callable.`
        );
    }

    if (isCallable(resolved) && getDef(obj.call, false)) {
        const requiredLength = (
            isFunction(resolved)
                ? /* function */ resolved
                : /* class    */ resolved.prototype.constructor || []
        ).length;

        const providedLength = (obj.parameters || []).length

        if (getDef(obj.call, true) && providedLength !== requiredLength) {
            throw new Error(
                `Referencing '${obj.path || obj}' but an invalid number of ` + 
                `parameters was passed to it. (provided ${providedLength}, ` + 
                `required ${requiredLength})`
            );
        }
    }

    return true;
};

/**
 * Performs the required action described by the specified path-object
 *
 * @param {} obj the path-object.
 * @param {*} resolved the resolved symbol
 * @param {*} data the data in which the path-object can reference items
 *
 * @returns an indication as to whether or not the path-object can be used
 *          to to express the resolved symbol, and if so, an async function
 *          that can be called to retrieve the corresponding value.
 */
const tryMakeReferenceable = async (obj, resolved, data) => {
    const REFERENCABLE = (cb) => ({ isReferenceable: true, getReference: cb})
    const REFERENCABLE_AS_RESOLVED = REFERENCABLE(async () => resolved);
    const NOT_REFERENCEABLE = { isReferenceable: false, getReference: undefined };

    if (!isValidPathObject(obj)) {
        return NOT_REFERENCEABLE;
    }

    if (!pathObjectExpressesSymbol(obj, resolved)) {
        return NOT_REFERENCEABLE;
    }

    if (!isCallable(resolved)) {
        return REFERENCABLE_AS_RESOLVED;
    }

    if(!getDef(obj.call, true)) {
        return REFERENCABLE_AS_RESOLVED;
    }

    // Process references in parameters
    if (obj.supportsNested && obj.parameters && obj.parameters.length > 0) {
        obj.parameters = await fill({
            input: obj.parameters,
            data
        });
    }

    if (isFunction(resolved)) {
        /* call function     */
        return REFERENCABLE(
            async () => await resolved(...(obj.parameters || []))
        );
    } else {
        /* instantiate class */
        return REFERENCABLE(
            async () => new resolved(...(obj.parameters || []))
        );
    }
}

/**
 * Recursively resolves all path-objects found in the input.
 *
 * @param {any} input the input object
 * @param {object} data data in which path-objects can reference items
 * @param {array} ignoredPaths an array of dot-paths that should be ignored
 * @param {string} currentPath this is an internal variable and should not be set
 * 
 * @returns the original input with all path-objects resolved
 */
const fill = async ({
    input,
    data,
    ignoredPaths = [],
    currentPath = []
}) => {
    if (!['string', 'object'].includes(typeof input)) {
        return input;
    }

    const parsed = parsePathObject(input);
    const pathPointsTo = tryResolveDotPath(parsed.path, data);
    const {
        isReferenceable: _isDataReferenceable,
        getReference: _getDataReference
    } = await tryMakeReferenceable(parsed, pathPointsTo, data);
    if (_isDataReferenceable) {
        return await _getDataReference();
    }

    if (typeof input === 'string') {
        return input;
    }

    if (Array.isArray(input)) {
        for (const [i, v] of input.entries()) {
            input[i] = await (async (e, idx) => {
                currentPath.push(idx);
                let res;
                if (!ignoredPaths.includes(currentPath.join('.'))) {
                    currentPath.pop();
                    res = await fill({
                        input: e,
                        data,
                        ignoredPaths,
                        currentPath: [...currentPath]
                    });
                } else {
                    currentPath.pop();
                    res = Promise.resolve(e);
                }
                return res;
            })(v, i)
        }
        return input;
    }

    const entries = Object.entries(input);
    for(const [i,e] of entries.entries()) {
        entries[i] = await (async ([k, v]) => {
            currentPath.push(k);
            if (!ignoredPaths.includes(currentPath.join('.'))) {
                const parsed = parsePathObject(v);
                const pathPointsTo = tryResolveDotPath(parsed.path || v, data);
                const {
                    isReferenceable: _isItemReferenceable,
                    getReference: _getItemReference
                } = await tryMakeReferenceable(parsed, pathPointsTo, data);
                const res = [k, (
                    _isItemReferenceable
                        ? await _getItemReference()
                        : await fill({
                            input: v,
                            data,
                            ignoredPaths,
                            currentPath: [...currentPath]
                        })
                )];
                currentPath.pop();
                return res;
            }
            currentPath.pop();
            return [k, v];
        })(e)
    }

    return Object.fromEntries(
        entries
    );
}

module.exports = { fill, parsePathObject };

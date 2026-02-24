if (!(Promise as any).withResolvers) {
  (Promise as any).withResolvers = function () {
    let resolve: (value: unknown) => void;
    let reject: (reason?: any) => void;
    const promise = new Promise((res, rej) => {
      resolve = res as any;
      reject = rej as any;
    });
    return { promise, resolve: resolve!, reject: reject! };
  };
}

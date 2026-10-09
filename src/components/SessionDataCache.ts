export function createSessionDataCache<T>() {
  let data: T | undefined;
  let inFlightRequest: Promise<T> | null = null;

  return {
    get: () => data,
    hasData: () => data !== undefined,
    clear: () => {
      data = undefined;
    },
    load: (loader: () => Promise<T>) => {
      if (inFlightRequest) return inFlightRequest;

      const request = loader().then((value) => {
        data = value;
        return value;
      });
      inFlightRequest = request;
      void request.then(
        () => {
          if (inFlightRequest === request) inFlightRequest = null;
        },
        () => {
          if (inFlightRequest === request) inFlightRequest = null;
        },
      );
      return request;
    },
  };
}

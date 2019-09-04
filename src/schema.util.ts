import unset from 'lodash/unset';

export function mapperConfig<T>(
  exclude: string[],
  preCleanup?: (data: T) => any
) {
  exclude.unshift('_id');
  preCleanup = preCleanup ? preCleanup : x => x;

  // default config for toJSON and toObject
  return {
    virtuals: true,
    versionKey: false,
    transform: (doc: any, data: any, options: any) => {
      data = preCleanup(data);
      exclude.forEach(path => {
        unset(data, path);
      });
      return data;
    }
  };
}

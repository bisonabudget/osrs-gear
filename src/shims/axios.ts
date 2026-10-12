// The engine's utils.ts imports axios for hiscore and share-link calls this site doesn't use.
// Like axios, responses default to any.
interface Response<T> { data: T }
const unused = <T>(): Promise<Response<T>> => Promise.reject(new Error('axios is not bundled'));

export default {
  get: <T = any>(_url: string) => unused<T>(),
  post: <T = any>(_url: string, _body?: unknown, _config?: unknown) => unused<T>(),
};

export type Identifier = string;

export type ApiResponse<T> = {
  data: T;
  message?: string;
};

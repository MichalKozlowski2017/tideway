declare module "google-trends-api" {
  interface TrendsOptions {
    keyword: string | string[];
    geo?: string;
    startTime?: Date;
    endTime?: Date;
  }

  const googleTrends: {
    relatedQueries: (options: TrendsOptions) => Promise<string>;
    interestOverTime: (options: TrendsOptions) => Promise<string>;
  };

  export default googleTrends;
}

/* eslint-disable no-var */

declare global {
	var __oplink_cli__:
		| undefined
		| {
				entry: string;
				startTime: number;
		  };
}

export {};

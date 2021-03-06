import { onError } from "apollo-link-error";
import { GraphQLError } from "graphql";
import { DataSyncConfig } from "../config";
import { CONFLICT_ERROR } from "../config/Constants";
import { ConflictResolutionData, ConflictResolutionStrategy, strategies } from "./strategies";
import { ApolloLink } from "apollo-link";

export const conflictLink = (config: DataSyncConfig): ApolloLink => {
  /**
  * Fetch conflict data from the errors returned from the server
  * @param graphQLErrors array of errors to retrieve conflicted data from
  */
  const getConflictData = (graphQLErrors?: ReadonlyArray<GraphQLError>): ConflictResolutionData => {
    if (graphQLErrors) {
      for (const err of graphQLErrors) {
        if (err.extensions) {
          // TODO need to add flag to check if conflict was resolved on the server
          if (err.extensions.exception.type === CONFLICT_ERROR) {
            return err.extensions.exception.data;
          }
        }
      }
    }
  };
  /**
   * Fetch the conflict strategy if one is provided, if not return client wins.
   */
  const getConflictStrategy = (): ConflictResolutionStrategy => {
    if (config.conflictStrategy) {
      return config.conflictStrategy;
    } else {
      return strategies.diffMergeClientWins;
    }
  };

  return onError(({ operation, forward, graphQLErrors }) => {
    const data = getConflictData(graphQLErrors);
    if (data) {
      const resolvedConflict = getConflictStrategy()(data, operation.variables);
      // TODO Notify
      resolvedConflict.version = data.version;
      operation.variables = resolvedConflict;
      return forward(operation);
    }
  });
};

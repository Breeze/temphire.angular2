import { Entity, EntityManager, EntityQuery, EntityType, FetchStrategy, Predicate } from 'breeze-client';

export interface IRepository<T> {
    withId(key: any): Promise<T>;
    where(predicate: Predicate): Promise<T[]>;
    whereInCache(predicate: Predicate): T[];
    all(): Promise<T[]>;
}

export class Repository<T> implements IRepository<T> {

    private _resourceNameSet: boolean;
    protected _defaultFetchStrategy: FetchStrategy;

    constructor(private _manager: EntityManager,
                protected _entityTypeName: string,
                protected _resourceName: string,
                protected _isCachedBundle: boolean = false) {

        this._defaultFetchStrategy = _isCachedBundle ? FetchStrategy.FromLocalCache : FetchStrategy.FromServer;
    }

    protected get manager(): EntityManager {
        if (this._resourceNameSet) { return this._manager; }
        const metadataStore = this._manager.metadataStore;

        const entityType = metadataStore.getEntityType(this._entityTypeName || '', true) as EntityType;
        if (entityType) {
            entityType.setProperties({ defaultResourceName: this.localResourceName });
            metadataStore.setEntityTypeForResourceName(this.localResourceName, entityType);
        }

        return this._manager;
    }

    protected get localResourceName() {
        return this._isCachedBundle ? this._entityTypeName : this._resourceName;
    }

    withId(key: any): Promise<T> {
        if (!this._entityTypeName) {
            throw new Error('Repository must be created with an entity type specified');
        }

        return this.manager.fetchEntityByKey(this._entityTypeName, key, true)
            .then(function(data) {
                return data.entity;
            }).catch(e => {
                if (e.status == 404) {
                    return null;
                }

                // Something else happened
                throw e;
            });
    }

    where(predicate: Predicate): Promise<T[]> {
        const query = this.baseQuery().where(predicate);

        return this.executeQuery(query);
    }

    whereInCache(predicate: Predicate): T[] {
        const query = this.baseQuery().where(predicate);

        return this.executeCacheQuery(query);
    }

    all(): Promise<T[]> {
        const query = this.baseQuery();

        return this.executeQuery(query);
    }

    protected baseQuery(): EntityQuery {
        return EntityQuery.from(this.localResourceName);
    }

    protected executeQuery(query: EntityQuery, fetchStrategy?: FetchStrategy): Promise<T[]> {
        const q = query.using(fetchStrategy || this._defaultFetchStrategy);
        return this.manager.executeQuery(q).then(data => {
            return data.results as any as T[];
        }).catch(e => {
            if (e.status == 404) {
                return [] as T[];
            }

            // Something else happend, rethrow the exception
            throw e;
        });
    }

    protected executeCacheQuery(query: EntityQuery): T[] {
        return this.manager.executeQueryLocally(query) as any as T[];
    }
}

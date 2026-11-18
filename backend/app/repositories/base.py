"""Base repository enforcing strict multi-tenant isolation."""
from typing import Any, Generic, List, Optional, Type, TypeVar
from beanie import Document
from beanie.odm.queries.find import FindMany

DocType = TypeVar("DocType", bound=Document)


class TenantRepository(Generic[DocType]):
    """Base repository where all queries and mutations are strictly scoped to a tenant."""

    model: Type[DocType]

    def __init__(self, tenant_id: str):
        if not tenant_id:
            raise ValueError("tenant_id must be provided to TenantRepository")
        self.tenant_id = tenant_id

    async def get_by_id(self, doc_id: str) -> Optional[DocType]:
        """Fetch document by ID strictly belonging to this tenant."""
        doc = await self.model.find_one(
            self.model.id == doc_id,
            self.model.tenant_id == self.tenant_id  # type: ignore
        )
        return doc

    def _query(self, *criteria) -> FindMany[DocType]:
        """Internal helper scoping any find query to self.tenant_id."""
        return self.model.find(
            self.model.tenant_id == self.tenant_id,  # type: ignore
            *criteria
        )

    async def find_all(
        self,
        *criteria,
        sort: Any = None,
        limit: Optional[int] = None,
        skip: Optional[int] = None
    ) -> List[DocType]:
        """Find all documents for tenant matching criteria."""
        q = self._query(*criteria)
        if sort is not None:
            q = q.sort(sort)
        if skip is not None:
            q = q.skip(skip)
        if limit is not None:
            q = q.limit(limit)
        return await q.to_list()

    async def find_one(self, *criteria) -> Optional[DocType]:
        """Find one document for tenant matching criteria."""
        return await self._query(*criteria).first_or_none()

    async def count(self, *criteria) -> int:
        """Count tenant documents matching criteria."""
        return await self._query(*criteria).count()

    async def create(self, **kwargs) -> DocType:
        """Create a new document, forcefully injecting self.tenant_id."""
        kwargs["tenant_id"] = self.tenant_id
        instance = self.model(**kwargs)
        await instance.insert()
        return instance

    async def update(self, doc_id: str, **kwargs) -> Optional[DocType]:
        """Update a document if and only if it belongs to this tenant."""
        doc = await self.get_by_id(doc_id)
        if not doc:
            return None
        # Disallow tampering with tenant_id or id
        kwargs.pop("tenant_id", None)
        kwargs.pop("id", None)
        for key, value in kwargs.items():
            if hasattr(doc, key):
                setattr(doc, key, value)
        await doc.save()
        return doc

    async def delete(self, doc_id: str) -> bool:
        """Delete a document if and only if it belongs to this tenant."""
        doc = await self.get_by_id(doc_id)
        if not doc:
            return False
        await doc.delete()
        return True

    async def delete_all_for_tenant(self) -> int:
        """Delete all documents belonging to this tenant."""
        result = await self.model.find(self.model.tenant_id == self.tenant_id).delete()  # type: ignore
        return getattr(result, "deleted_count", 0)

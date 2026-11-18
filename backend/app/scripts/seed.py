"""Seed script for global templates matching frontend specification."""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie

if not hasattr(AsyncIOMotorClient, "append_metadata"):
    AsyncIOMotorClient.append_metadata = lambda self, *args, **kwargs: None
from app.core.config import get_settings
from app.models.template import Template
from app.models import ALL_DOCUMENT_MODELS

settings = get_settings()

SEED_TEMPLATES = [
    {
        "id": "t1",
        "tenant_id": "global",
        "global_template": True,
        "name": "Fresher application",
        "subject": "Application for {{role}} – {{my_name}}",
        "body": "<p>Dear {{hr_name}},</p><p>I am a recent graduate keen to start my career as a {{role}} at {{company}}. My skills include {{skills}}.</p><p>I have attached my resume and would welcome a chance to talk.</p><p>Regards,<br>{{my_name}}</p>"
    },
    {
        "id": "t2",
        "tenant_id": "global",
        "global_template": True,
        "name": "Experienced application",
        "subject": "{{role}} opportunity at {{company}} – {{my_name}}",
        "body": "<p>Hi {{hr_name}},</p><p>I'm excited about the {{role}} position at {{company}}. With hands-on experience in {{skills}}, I believe I can contribute quickly.</p><p>My resume is attached. Happy to share more.</p><p>Best,<br>{{my_name}}</p>"
    },
    {
        "id": "t3",
        "tenant_id": "global",
        "global_template": True,
        "name": "Referral request",
        "subject": "Referral request for {{role}} at {{company}}",
        "body": "<p>Hi {{hr_name}},</p><p>I'd be grateful for a referral for the {{role}} role at {{company}}. My background in {{skills}} matches the requirements.</p><p>Thank you,<br>{{my_name}}</p>"
    },
    {
        "id": "t4",
        "tenant_id": "global",
        "global_template": True,
        "name": "Follow-up after 5 days",
        "subject": "Following up: {{role}} application",
        "body": "<p>Hi {{hr_name}},</p><p>I wanted to follow up on my application for {{role}} at {{company}}. I remain very interested and happy to provide anything further.</p><p>Thanks,<br>{{my_name}}</p>"
    },
    {
        "id": "t5",
        "tenant_id": "global",
        "global_template": True,
        "name": "Thank-you after interview",
        "subject": "Thank you – {{role}} interview",
        "body": "<p>Hi {{hr_name}},</p><p>Thank you for taking the time to interview me for the {{role}} position at {{company}}. I enjoyed learning more about the team.</p><p>Best regards,<br>{{my_name}}</p>"
    },
]


async def seed_global_templates():
    """Ensure the 5 standard global templates exist in MongoDB."""
    for tpl_data in SEED_TEMPLATES:
        existing = await Template.get(tpl_data["id"])
        if not existing:
            tpl = Template(**tpl_data)
            await tpl.insert()
            print(f"Seeded global template: {tpl.name}")


async def main():
    client = AsyncIOMotorClient(settings.mongo_uri)
    await init_beanie(database=client[settings.mongo_db], document_models=ALL_DOCUMENT_MODELS)
    await seed_global_templates()
    client.close()
    print("Database seeding completed.")


if __name__ == "__main__":
    asyncio.run(main())

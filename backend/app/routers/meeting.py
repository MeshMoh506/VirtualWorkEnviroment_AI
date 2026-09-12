from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.agents import meeting
from app.auth import get_current_user
from app.database import get_db
from app.models import AgentType, User
from app.schemas import ChatMessageOut, ChatSend

router = APIRouter(prefix="/meeting", tags=["meeting"])


@router.get("/{agent}", response_model=list[ChatMessageOut])
def get_conversation(
    agent: AgentType,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The running conversation with one agent in the Meeting Room. Empty
    list until the graduate sends their first message. FastAPI validates
    `agent` against AgentType, so an unknown agent returns 422."""
    return meeting.get_history(db, current_user, agent)


@router.post("/{agent}", response_model=ChatMessageOut, status_code=201)
def send_message(
    agent: AgentType,
    payload: ChatSend,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send a message to an agent; returns the agent's reply. The user's own
    message is persisted server-side before the reply is generated, so the
    frontend appends its message optimistically and only needs the reply
    back."""
    return meeting.send_message(db, current_user, agent, payload.content)
